import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/types/database';
import { createAdminClient } from '../../src/lib/server/media/repo';
import { createPost } from '../../src/lib/server/db/posts';
import {
	getFollowingFeedPage,
	getHotFeedPage,
	getTopFeedPage
} from '../../src/lib/server/db/feeds';
import { hotScore } from '../../src/lib/domain/feed/hot-score';

// Runs against LOCAL Supabase with REAL authed clients (CLAUDE.md §6 — never mock the DB).
// Proves the four feeds order correctly, stay approved-only, paginate without dup/skip,
// and that the DB-stored hot_score equals the pure spec (ranking can't silently drift).
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const PUBLISHABLE = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

const admin = createAdminClient(URL, SECRET);
const anon = () => createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });

interface AuthedUser {
	id: string;
	client: SupabaseClient<Database>;
}

async function makeUser(): Promise<AuthedUser> {
	const tag = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
	const email = `feeds_${tag}@example.test`;
	const password = 'password123';
	const { data, error } = await admin.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { username: `f_${tag}` }
	});
	if (error) throw error;

	const client = createClient<Database>(URL, PUBLISHABLE, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
	const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
	if (signInErr) throw signInErr;
	return { id: data.user.id, client };
}

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

/** Create an approved post owned by `user` with a fresh approved media cover. */
async function createApprovedPost(user: AuthedUser, title: string): Promise<string> {
	const mediaId = await seedMedia(user.id);
	return createPost(user.client, { title, description: null, mediaIds: [mediaId] });
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

let alice: AuthedUser;
let bob: AuthedUser;

beforeAll(async () => {
	alice = await makeUser();
	bob = await makeUser();
});

afterAll(async () => {
	await admin.auth.admin.deleteUser(alice.id); // cascades posts, media, follows
	await admin.auth.admin.deleteUser(bob.id);
});

describe('feeds (integration)', () => {
	it('stores hot_score from the same formula the pure domain uses', async () => {
		const postId = await createApprovedPost(alice, 'parity');
		const { data, error } = await alice.client
			.from('posts')
			.select('created_at, hot_score')
			.eq('id', postId)
			.single();
		expect(error).toBeNull();
		// score is 0 until ratings (Slice 6), so DB hot_score == hotScore(0, created_at).
		const expected = hotScore(0, Date.parse(data!.created_at));
		expect(data!.hot_score).toBeCloseTo(expected, 6);
	});

	it('orders the Hot feed by hot_score and paginates without dup/skip', async () => {
		const ids: string[] = [];
		for (let i = 0; i < 3; i++) ids.push(await createApprovedPost(alice, `hot ${i}`));
		const [p1, p2, p3] = ids; // created oldest → newest

		// Small limit so the (hot_score, id) cursor crosses a page boundary (it must round-trip
		// the float without skipping or repeating). No ratings yet → hot_score is monotonic
		// with recency, so newest ranks highest.
		const page1 = await getHotFeedPage(anon(), null, 2);
		const page2 = await getHotFeedPage(anon(), page1.nextCursor, 2);
		const seen = [...page1.cards, ...page2.cards].map((c) => c.id);

		expect(seen.filter((id) => ids.includes(id))).toEqual([p3, p2, p1]);
		const page1Ids = new Set(page1.cards.map((c) => c.id));
		expect(page2.cards.some((c) => page1Ids.has(c.id))).toBe(false);
	});

	it('keeps non-approved posts out of the Hot feed', async () => {
		const postId = await createApprovedPost(alice, 'held-hot');
		await admin.from('posts').update({ moderation_state: 'held' }).eq('id', postId);

		const { cards } = await getHotFeedPage(anon(), null, 50);
		expect(cards.find((c) => c.id === postId)).toBeUndefined();
	});

	it('filters the Top feed by its time window', async () => {
		const recent = await createApprovedPost(alice, 'top recent');
		const midWeek = await createApprovedPost(alice, 'top midweek');
		const old = await createApprovedPost(alice, 'top old');
		await admin
			.from('posts')
			.update({ created_at: daysAgo(3) })
			.eq('id', midWeek);
		await admin
			.from('posts')
			.update({ created_at: daysAgo(10) })
			.eq('id', old);

		const inWindow = async (w: 'day' | 'week' | 'all') =>
			new Set((await getTopFeedPage(anon(), w, null, 50)).cards.map((c) => c.id));

		const day = await inWindow('day');
		expect(day.has(recent)).toBe(true);
		expect(day.has(midWeek)).toBe(false);
		expect(day.has(old)).toBe(false);

		const week = await inWindow('week');
		expect(week.has(recent)).toBe(true);
		expect(week.has(midWeek)).toBe(true);
		expect(week.has(old)).toBe(false);

		const all = await inWindow('all');
		expect(all.has(recent) && all.has(midWeek) && all.has(old)).toBe(true);
	});

	it('shows only followed authors’ approved posts in the Following feed', async () => {
		// Alice follows Bob (seeded via service-role; the follow button arrives in Slice 10).
		await admin.from('follows').insert({ follower_id: alice.id, followee_id: bob.id });

		const bobPost = await createApprovedPost(bob, 'from bob');
		const alicePost = await createApprovedPost(alice, 'from alice (not followed)');
		const bobHeld = await createApprovedPost(bob, 'bob held');
		await admin.from('posts').update({ moderation_state: 'held' }).eq('id', bobHeld);

		const { cards } = await getFollowingFeedPage(alice.client, alice.id, null, 50);
		const ids = cards.map((c) => c.id);
		expect(ids).toContain(bobPost);
		expect(ids).not.toContain(alicePost); // Alice doesn't follow herself
		expect(ids).not.toContain(bobHeld); // non-approved excluded
	});

	it('returns an empty Following feed when the viewer follows nobody', async () => {
		const loner = await makeUser();
		try {
			await createApprovedPost(alice, 'nobody follows context');
			const page = await getFollowingFeedPage(loner.client, loner.id, null, 50);
			expect(page).toEqual({ cards: [], nextCursor: null });
		} finally {
			await admin.auth.admin.deleteUser(loner.id);
		}
	});
});
