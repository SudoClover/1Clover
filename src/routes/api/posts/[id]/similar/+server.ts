/**
 * "Similar posts" for a given post — approved-only (RLS), ranked by tag overlap. This is
 * the stable interface the detail page calls and that a future pgvector slice slots into
 * without changing callers. A malformed id is rejected before it reaches the query.
 */
import { error, json } from '@sveltejs/kit';
import { UUID_RE } from '$lib/domain/posts/post-input';
import { getSimilarPosts } from '$lib/server/db/tags';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!UUID_RE.test(params.id)) error(400, 'Invalid post id.');

	try {
		return json(await getSimilarPosts(locals.supabase, params.id));
	} catch (e) {
		console.error('[similar] query failed:', (e as Error).message);
		return json([]);
	}
};
