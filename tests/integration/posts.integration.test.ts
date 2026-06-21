import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/types/database';
import { createAdminClient } from '../../src/lib/server/media/repo';
import {
	createPost,
	deletePost,
	getBoardPage,
	getPostById,
	listPostableMedia,
	updatePost
} from '../../src/lib/server/db/posts';

// Runs against LOCAL Supabase with REAL authed clients (CLAUDE.md §6 — never mock the
// DB). This is the dynamic two-user proof of the posts RLS + the create_post RPC: an
// author owns their posts; a non-owner cannot touch them; only approved is public.
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const PUBLISHABLE = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

const admin = createAdminClient(URL, SECRET);
const anon = () => createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });

interface AuthedUser {
	id: string;
	client: SupabaseClient<Database>;
}

/** A confirmed user + a client signed in AS that user (so auth.uid() is real). */
async function makeUser(): Promise<AuthedUser> {
	const tag = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
	const email = `posts_${tag}@example.test`;
	const password = 'password123';
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { username: `p_${tag}` }
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
		checksum: 'a'.repeat(64),
		variants: { safe: `${key}/safe.webp`, thumb: `${key}/thumb.webp` },
		processing_state: 'ready',
		moderation_state: 'approved'
	});
	if (error) throw error;
	return id;
}

let alice: AuthedUser;
let bob: AuthedUser;

beforeAll(async () => {
	alice = await makeUser();
	bob = await makeUser();
});

afterAll(async () => {
	// Cascades the users' posts + media.
	await admin.auth.admin.deleteUser(alice.id);
	await admin.auth.admin.deleteUser(bob.id);
});

describe('posts (integration)', () => {
	it('creates a post that appears on the public board and its detail page', async () => {
		const mediaId = await seedMedia(alice.id);
		const title = `Hello ${crypto.randomUUID().slice(0, 8)}`;
		const postId = await createPost(alice.client, {
			title,
			description: 'a caption',
			mediaIds: [mediaId]
		});
		expect(postId).toMatch(/^[0-9a-f-]{36}$/);

		const board = await getBoardPage(anon());
		const card = board.cards.find((c) => c.id === postId);
		expect(card?.title).toBe(title);
		expect(card?.cover).toMatch(/\/media\/.*thumb\.webp$/);

		const post = await getPostById(anon(), postId);
		expect(post?.description).toBe('a caption');
		expect(post?.media[0]?.src).toMatch(/\/media\/.*safe\.webp$/);
	});

	it('lists only the caller’s approved media as postable', async () => {
		const mine = await seedMedia(alice.id);
		expect((await listPostableMedia(alice.client, alice.id)).some((m) => m.id === mine)).toBe(true);
		// Bob cannot see Alice's media in his postable library.
		expect((await listPostableMedia(bob.client, bob.id)).some((m) => m.id === mine)).toBe(false);
	});

	it('hides a non-approved post from the public but not from its author', async () => {
		const mediaId = await seedMedia(alice.id);
		const postId = await createPost(alice.client, {
			title: 'To be held',
			description: null,
			mediaIds: [mediaId]
		});

		// A moderator (service-role) holds it — clients cannot set moderation_state.
		const { error } = await admin
			.from('posts')
			.update({ moderation_state: 'held' })
			.eq('id', postId);
		expect(error).toBeNull();

		expect(await getPostById(anon(), postId)).toBeNull();
		expect(await getPostById(bob.client, postId)).toBeNull();
		expect((await getBoardPage(anon())).cards.find((c) => c.id === postId)).toBeUndefined();
		// Even the AUTHOR's own board excludes their held post (the explicit approved
		// filter, not just anon RLS, keeps non-approved off the public board).
		expect((await getBoardPage(alice.client)).cards.find((c) => c.id === postId)).toBeUndefined();
		// The author still sees their own held post on its detail page.
		expect((await getPostById(alice.client, postId))?.id).toBe(postId);
	});

	it('lets the author edit/delete but blocks a non-owner (RLS)', async () => {
		const mediaId = await seedMedia(alice.id);
		const postId = await createPost(alice.client, {
			title: 'Original',
			description: null,
			mediaIds: [mediaId]
		});

		// Non-owner edit affects zero rows (RLS) → returns false; nothing changes.
		expect(await updatePost(bob.client, postId, { title: 'Hijacked', description: 'nope' })).toBe(
			false
		);
		expect((await getPostById(anon(), postId))?.title).toBe('Original');

		// Owner edit applies (returns true) and the trigger stamps edited_at.
		expect(
			await updatePost(alice.client, postId, { title: 'Edited', description: 'updated' })
		).toBe(true);
		const edited = await getPostById(anon(), postId);
		expect(edited?.title).toBe('Edited');
		expect(edited?.editedAt).not.toBeNull();

		// Non-owner delete is a no-op (false); owner delete removes it (true).
		expect(await deletePost(bob.client, postId)).toBe(false);
		expect((await getPostById(anon(), postId))?.id).toBe(postId);
		expect(await deletePost(alice.client, postId)).toBe(true);
		expect(await getPostById(anon(), postId)).toBeNull();
	});

	it('refuses to link media the author does not own, leaving no orphan post', async () => {
		const bobsMedia = await seedMedia(bob.id);
		const title = `Orphan ${crypto.randomUUID().slice(0, 8)}`;
		await expect(
			createPost(alice.client, { title, description: null, mediaIds: [bobsMedia] })
		).rejects.toBeTruthy();

		// The whole transaction rolled back: Alice (who can see her own posts) has none.
		const { data } = await alice.client.from('posts').select('id').eq('title', title);
		expect(data).toEqual([]);
	});

	it('paginates the board by keyset without duplicating or skipping posts', async () => {
		const ids: string[] = [];
		for (let i = 0; i < 3; i++) {
			const mediaId = await seedMedia(alice.id);
			ids.push(
				await createPost(alice.client, {
					title: `Page ${i}`,
					description: null,
					mediaIds: [mediaId]
				})
			);
		}
		const [p1, p2, p3] = ids; // created oldest → newest

		const page1 = await getBoardPage(anon(), null, 2);
		const page2 = await getBoardPage(anon(), page1.nextCursor, 2);

		const seen = [...page1.cards, ...page2.cards].map((c) => c.id);
		// Newest-first across the page boundary, with my three the most recent.
		expect(seen.filter((id) => ids.includes(id))).toEqual([p3, p2, p1]);

		const page1Ids = new Set(page1.cards.map((c) => c.id));
		expect(page2.cards.some((c) => page1Ids.has(c.id))).toBe(false);
	});
});
