import { getBoardPage } from '$lib/server/db/posts';
import type { PageServerLoad } from './$types';

// The public board: approved posts, newest first, each with a cover thumbnail. RLS
// already restricts anonymous/other users to approved posts; the query mirrors that.
// A read failure shows an empty board rather than 500-ing the homepage.
export const load: PageServerLoad = async ({ locals }) => {
	try {
		const { cards, nextCursor } = await getBoardPage(locals.supabase);
		return { cards, nextCursor };
	} catch (e) {
		console.error('[board] post query failed:', (e as Error).message);
		return { cards: [], nextCursor: null };
	}
};
