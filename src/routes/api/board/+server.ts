/**
 * Keyset pagination for the board's infinite scroll. Returns the next page of cards
 * after the (created_at, id) cursor. Public + approved-only (RLS); no offset, so
 * there's no enumeration of hidden rows.
 */
import { error, json } from '@sveltejs/kit';
import { UUID_RE } from '$lib/domain/posts/post-input';
import { getBoardPage } from '$lib/server/db/posts';
import type { BoardCursor } from '$lib/domain/posts/types';
import type { RequestHandler } from './$types';

// A plain timestamptz (what the server itself issued as the cursor) — no commas or
// parens, so it can't perturb the PostgREST filter string it's interpolated into.
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)?$/;

export const GET: RequestHandler = async ({ url, locals }) => {
	const cursor = parseCursor(url);

	try {
		const page = await getBoardPage(locals.supabase, cursor);
		return json(page);
	} catch (e) {
		console.error('[board] page query failed:', (e as Error).message);
		return json({ cards: [], nextCursor: null });
	}
};

/** Validate the client-supplied cursor before it reaches the query. RLS is the real
 *  confidentiality boundary, but rejecting a malformed cursor keeps untrusted input
 *  out of the filter entirely (defense in depth) and fails fast on tampering. */
function parseCursor(url: URL): BoardCursor | null {
	const createdAt = url.searchParams.get('cursor_created');
	const id = url.searchParams.get('cursor_id');
	if (!createdAt && !id) return null;
	if (!createdAt || !id || !TIMESTAMP_RE.test(createdAt) || !UUID_RE.test(id)) {
		error(400, 'Invalid board cursor.');
	}
	return { createdAt, id };
}
