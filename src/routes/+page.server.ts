import { getBoardPage } from '$lib/server/db/posts';
import { getFollowingFeedPage, getHotFeedPage, getTopFeedPage } from '$lib/server/db/feeds';
import { parseFeedMode, parseTopWindow } from '$lib/domain/feed/request';
import type { BoardCursor, FeedMode, HotCursor, TopWindow } from '$lib/domain/feed/types';
import type { BoardCard } from '$lib/domain/posts/types';
import type { PageServerLoad } from './$types';

interface FeedPage {
	cards: BoardCard[];
	nextCursor: BoardCursor | HotCursor | null;
}

// The board, in the selected feed mode. RLS + the approved-only filter keep non-approved
// and other users' content out; a read failure shows an empty feed rather than 500-ing.
export const load: PageServerLoad = async ({ url, locals }) => {
	const mode = parseFeedMode(url.searchParams.get('mode'));
	const topWindow = parseTopWindow(url.searchParams.get('window'));

	try {
		const page = await loadFeed(locals, mode, topWindow);
		return { ...page, mode, topWindow };
	} catch (e) {
		console.error(`[feed:${mode}] load failed:`, (e as Error).message);
		return { cards: [], nextCursor: null, mode, topWindow };
	}
};

async function loadFeed(
	locals: App.Locals,
	mode: FeedMode,
	topWindow: TopWindow
): Promise<FeedPage> {
	switch (mode) {
		case 'hot':
			return getHotFeedPage(locals.supabase, null);
		case 'top':
			return getTopFeedPage(locals.supabase, topWindow, null);
		case 'following': {
			const viewerId = locals.claims?.sub;
			if (!viewerId) return { cards: [], nextCursor: null };
			return getFollowingFeedPage(locals.supabase, viewerId, null);
		}
		default:
			return getBoardPage(locals.supabase, null);
	}
}
