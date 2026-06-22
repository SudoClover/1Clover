/**
 * Server-side feed queries (ARCHITECTURE.md §4.2 — Slice 5). Every feed returns the same
 * `BoardCard` render shape and differs only in ORDER + cursor. All run on the per-request
 * authed client, so RLS plus the explicit approved-only filter keep non-approved and other
 * users' content out. Ranking lives in pure domain code (`../../domain/feed`).
 *
 * New is the existing board query (`getBoardPage` in `./posts`). Hot/Top mirror New until
 * ratings exist (Slice 6) — see `hot-score.ts`. Only re-encoded variant URLs are exposed.
 */
import type { DbClient } from './posts';
import { BOARD_PAGE_SIZE, MEDIA_EMBED, coverFields, readyMedia } from './posts';
import type { BoardCard, BoardCursor, BoardPage } from '../../domain/posts/types';
import type { HotCursor, TopWindow } from '../../domain/feed/types';
import { windowStart } from '../../domain/feed/windows';

export interface HotPage {
	cards: BoardCard[];
	nextCursor: HotCursor | null;
}

// Max followees we read for the Following feed; generous for now (Slice 10 owns the graph).
const MAX_FOLLOWEES = 1000;

/** Hottest approved posts first. The keyset (hot_score, id) is resolved in SQL by the
 *  hot_feed_page RPC — the cursor is just the last id, so the float never round-trips
 *  through the client (PostgREST truncates float8). */
export async function getHotFeedPage(
	client: DbClient,
	cursor: HotCursor | null,
	limit: number = BOARD_PAGE_SIZE
): Promise<HotPage> {
	const { data: ids, error } = await client.rpc('hot_feed_page', {
		p_limit: limit + 1,
		p_cursor_id: cursor?.id
	});
	if (error) throw error;

	const { page, hasMore } = splitPage(ids ?? [], limit);
	const last = page.at(-1);
	return {
		cards: await cardsByIds(client, page),
		nextCursor: hasMore && last ? { id: last } : null
	};
}

/** Top approved posts within a time window, keyset on (created_at, id). Until ratings land
 *  (Slice 6) there's no score signal, so this orders by recency within the window; Slice 6
 *  swaps the primary sort to rating count without changing this interface. */
export async function getTopFeedPage(
	client: DbClient,
	window: TopWindow,
	cursor: BoardCursor | null,
	limit: number = BOARD_PAGE_SIZE,
	nowMs: number = Date.now()
): Promise<BoardPage> {
	const since = windowStart(window, nowMs);

	let query = client
		.from('posts')
		.select(`id, title, created_at, ${MEDIA_EMBED}`)
		.eq('moderation_state', 'approved')
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(limit + 1);

	if (since) query = query.gte('created_at', since);
	if (cursor) query = applyCreatedKeyset(query, cursor);

	const { data, error } = await query;
	if (error) throw error;
	return toCreatedPage(data ?? [], limit);
}

/** Approved posts from the authors `viewerId` follows, newest first, keyset on
 *  (created_at, id). Empty (the "follow someone" state) when they follow nobody. */
export async function getFollowingFeedPage(
	client: DbClient,
	viewerId: string,
	cursor: BoardCursor | null,
	limit: number = BOARD_PAGE_SIZE
): Promise<BoardPage> {
	const { data: edges, error: edgesError } = await client
		.from('follows')
		.select('followee_id')
		.eq('follower_id', viewerId)
		.limit(MAX_FOLLOWEES);
	if (edgesError) throw edgesError;

	const followeeIds = (edges ?? []).map((e) => e.followee_id);
	if (followeeIds.length === 0) return { cards: [], nextCursor: null };

	let query = client
		.from('posts')
		.select(`id, title, created_at, ${MEDIA_EMBED}`)
		.eq('moderation_state', 'approved')
		.in('author_id', followeeIds)
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(limit + 1);

	if (cursor) query = applyCreatedKeyset(query, cursor);

	const { data, error } = await query;
	if (error) throw error;
	return toCreatedPage(data ?? [], limit);
}

// ── shared helpers ──────────────────────────────────────────────────────────

/** Apply the (created_at, id) keyset filter — newest-first rows strictly after the cursor. */
function applyCreatedKeyset<Q extends { or(filter: string): Q }>(query: Q, cursor: BoardCursor): Q {
	return query.or(
		`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
	);
}

/** Slice the limit+1 fetch into a page plus a hasMore flag. */
function splitPage<T>(rows: T[], limit: number): { page: T[]; hasMore: boolean } {
	const hasMore = rows.length > limit;
	return { page: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

/** Build a created_at-keyset BoardPage from a limit+1 fetch. */
function toCreatedPage(rows: (CardRow & { created_at: string })[], limit: number): BoardPage {
	const { page, hasMore } = splitPage(rows, limit);
	const last = page.at(-1);
	const nextCursor = hasMore && last ? { createdAt: last.created_at, id: last.id } : null;
	return { cards: buildCards(page), nextCursor };
}

/** Fetch cover cards for the given post ids (any order) and return them in `ids` order.
 *  Used by Hot, whose ordering is decided by the keyset RPC, not this query. */
async function cardsByIds(client: DbClient, ids: string[]): Promise<BoardCard[]> {
	if (ids.length === 0) return [];
	const { data, error } = await client
		.from('posts')
		.select(`id, title, ${MEDIA_EMBED}`)
		.in('id', ids);
	if (error) throw error;

	const byId = new Map(buildCards(data ?? []).map((card) => [card.id, card]));
	return ids.map((id) => byId.get(id)).filter((card): card is BoardCard => card !== undefined);
}

type CardRow = { id: string; title: string; post_media: Parameters<typeof readyMedia>[0] };

/** Map post rows to cover cards, dropping any with no approved+ready media. */
function buildCards(rows: readonly CardRow[]): BoardCard[] {
	return rows
		.map((row): BoardCard | null => {
			const cover = readyMedia(row.post_media)[0];
			return cover ? { id: row.id, title: row.title, ...coverFields(cover) } : null;
		})
		.filter((c): c is BoardCard => c !== null);
}
