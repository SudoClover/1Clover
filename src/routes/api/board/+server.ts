/**
 * Keyset pagination for the board's infinite scroll. Returns the next page of cards
 * after the (created_at, id) cursor. Public + approved-only (RLS); no offset, so
 * there's no enumeration of hidden rows.
 */
import { json } from '@sveltejs/kit';
import { getBoardPage } from '$lib/server/db/posts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	const createdAt = url.searchParams.get('cursor_created');
	const id = url.searchParams.get('cursor_id');
	const cursor = createdAt && id ? { createdAt, id } : null;

	try {
		const page = await getBoardPage(locals.supabase, cursor);
		return json(page);
	} catch (e) {
		console.error('[board] page query failed:', (e as Error).message);
		return json({ cards: [], nextCursor: null });
	}
};
