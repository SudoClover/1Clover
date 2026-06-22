/**
 * The feeds endpoint (ARCHITECTURE.md §4.2 — Slice 5). One route, four modes: New / Hot /
 * Top / Following. Public + approved-only (RLS + explicit filter); keyset cursors, so
 * there's no offset enumeration of hidden rows. A malformed cursor is a 400; a DB error
 * degrades to an empty page rather than 500-ing the board.
 */
import { error, isHttpError, json } from '@sveltejs/kit';
import { UUID_RE } from '$lib/domain/posts/post-input';
import { parseFeedMode, parseTopWindow } from '$lib/domain/feed/request';
import { getBoardPage } from '$lib/server/db/posts';
import { getFollowingFeedPage, getHotFeedPage, getTopFeedPage } from '$lib/server/db/feeds';
import type { BoardCursor, HotCursor } from '$lib/domain/feed/types';
import type { RequestHandler } from './$types';

// Plain server-issued cursor values — no commas/parens, so they can't perturb the
// PostgREST filter string they're interpolated into (defense in depth on top of RLS).
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)?$/;

export const GET: RequestHandler = async ({ url, locals }) => {
	const mode = parseFeedMode(url.searchParams.get('mode'));

	try {
		switch (mode) {
			case 'hot':
				return json(await getHotFeedPage(locals.supabase, parseHotCursor(url)));
			case 'top': {
				const window = parseTopWindow(url.searchParams.get('window'));
				return json(await getTopFeedPage(locals.supabase, window, parseCreatedCursor(url)));
			}
			case 'following': {
				// Following is per-viewer; authorize on verified claims, never getSession.
				const viewerId = locals.claims?.sub;
				if (!viewerId) return json({ cards: [], nextCursor: null });
				return json(await getFollowingFeedPage(locals.supabase, viewerId, parseCreatedCursor(url)));
			}
			default:
				return json(await getBoardPage(locals.supabase, parseCreatedCursor(url)));
		}
	} catch (e) {
		if (isHttpError(e)) throw e; // a 400 from cursor validation must reach the client
		console.error(`[feed:${mode}] query failed:`, (e as Error).message);
		return json({ cards: [], nextCursor: null });
	}
};

/** (created_at, id) cursor for New / Top / Following, or null when absent. 400 on tampering. */
function parseCreatedCursor(url: URL): BoardCursor | null {
	const createdAt = url.searchParams.get('cursor_created');
	const id = url.searchParams.get('cursor_id');
	if (!createdAt && !id) return null;
	if (!createdAt || !id || !TIMESTAMP_RE.test(createdAt) || !UUID_RE.test(id)) {
		error(400, 'Invalid feed cursor.');
	}
	return { createdAt, id };
}

/** Hot cursor — just the last page's id (the score boundary is resolved in SQL). 400 on
 *  tampering. */
function parseHotCursor(url: URL): HotCursor | null {
	const id = url.searchParams.get('cursor_id');
	if (!id) return null;
	if (!UUID_RE.test(id)) error(400, 'Invalid feed cursor.');
	return { id };
}
