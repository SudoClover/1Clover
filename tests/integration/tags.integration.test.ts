import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/types/database';
import { createAdminClient } from '../../src/lib/server/media/repo';
import { createPost } from '../../src/lib/server/db/posts';
import { getPostTags, getSimilarPosts, setPostTags } from '../../src/lib/server/db/tags';

// Runs against LOCAL Supabase with REAL authed clients (CLAUDE.md §6 — never mock the DB).
// Proves the tags RLS + set_post_tags RPC dynamically: an author tags only their own posts,
// a non-owner cannot, tags are shared across posts, and "similar" ranks approved overlap.
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const PUBLISHABLE = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

const admin = createAdminClient(URL, SECRET);
const anon = () => createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });

// Unique tag suffix so these tests' overlap is isolated from any other posts in the DB.
const run = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
const tag = (base: string) => `${base}-${run}`;

interface AuthedUser {
	id: string;
	client: SupabaseClient<Database>;
}

async function makeUser(): Promise<AuthedUser> {
	const t = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
	const email = `tags_${t}@example.test`;
	const password = 'password123';
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { username: `t_${t}` }
	});
	if (error) throw error;

	const client = createClient<Database>(URL, PUBLISHABLE, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
	if (signInErr) throw signInErr;
	return { id: data.user.id, client };
}

/** Seed an approved+ready media row owned by `ownerId` (service-role write). */
async function seedMedia(ownerId: string): Promise<string> {
	const id = crypto.randomUUID();
	const key = `${ownerId}/${id}`;
	const { error } = await admin.from('media').insert({
		id,
		owner_id: ownerId,
		storage_key: `${key}/original`,
		kind: 'image',
		mime_type: 'image/webp',
		byte_size: 2048,
		width: 80,
		height: 60,
		checksum: 'b'.repeat(64),
		variants: { safe: `${key}/safe.webp`, thumb: `${key}/thumb.webp` },
		processing_state: 'ready',
		moderation_state: 'approved'
	});
	if (error) throw error;
	return id;
}

/** Create an approved post owned by `user`, then set its tags. */
async function makePost(user: AuthedUser, title: string, tags: string[]): Promise<string> {
	const mediaId = await seedMedia(user.id);
	const postId = await createPost(user.client, { title, description: null, mediaIds: [mediaId] });
	if (tags.length > 0) await setPostTags(user.client, postId, tags);
	return postId;
}

let alice: AuthedUser;
let bob: AuthedUser;

beforeAll(async () => {
	alice = await makeUser();
	bob = await makeUser();
});

afterAll(async () => {
	await admin.auth.admin.deleteUser(alice.id);
	await admin.auth.admin.deleteUser(bob.id);
});

describe('tags (integration)', () => {
	it('tags a post, reads them back sorted, and shares tags across posts', async () => {
		const postId = await makePost(alice, 'Tagged', [tag('pixel'), tag('art')]);
		expect(await getPostTags(anon(), postId)).toEqual([tag('art'), tag('pixel')]);

		// A second post reusing one of the same tags — tags are global/shared.
		const other = await makePost(alice, 'Shares pixel', [tag('pixel')]);
		const similar = await getSimilarPosts(anon(), postId);
		expect(similar.map((c) => c.id)).toContain(other);

		// Re-setting tags replaces (not appends): now only one tag remains.
		await setPostTags(alice.client, postId, [tag('art')]);
		expect(await getPostTags(anon(), postId)).toEqual([tag('art')]);
	});

	it('blocks a non-owner from changing a post’s tags (RPC owner check)', async () => {
		const postId = await makePost(alice, 'Alice owns this', [tag('cat')]);

		await expect(setPostTags(bob.client, postId, [tag('hijack')])).rejects.toBeTruthy();
		// Nothing changed: Alice's tag is intact and the hijack tag was never linked.
		expect(await getPostTags(anon(), postId)).toEqual([tag('cat')]);
	});

	it('returns approved, overlap-ranked similar posts; excludes the target and held posts', async () => {
		const target = await makePost(alice, 'Target', [tag('a'), tag('b'), tag('c')]);
		const high = await makePost(alice, 'High overlap', [tag('a'), tag('b'), tag('c')]);
		const low = await makePost(alice, 'Low overlap', [tag('a')]);
		const none = await makePost(alice, 'No overlap', [tag('z')]);

		// A held post that shares all tags must NOT surface (approved-only, any viewer).
		const held = await makePost(alice, 'Held', [tag('a'), tag('b'), tag('c')]);
		const { error } = await admin.from('posts').update({ moderation_state: 'held' }).eq('id', held);
		expect(error).toBeNull();

		const similar = await getSimilarPosts(anon(), target);
		const ids = similar.map((c) => c.id);

		expect(ids).not.toContain(target); // never recommend the post itself
		expect(ids).not.toContain(none); // zero shared tags → excluded
		expect(ids).not.toContain(held); // non-approved → excluded
		// Most shared tags first: high (3) before low (1).
		expect(ids.indexOf(high)).toBeLessThan(ids.indexOf(low));
		expect(ids).toContain(low);

		// Even the author (who can read their own held post) doesn't see it in similar.
		const asAuthor = await getSimilarPosts(alice.client, target);
		expect(asAuthor.map((c) => c.id)).not.toContain(held);
	});
});
