/**
 * Pure parsing of feed request params (ARCHITECTURE.md §4.2 — Slice 5). Untrusted query
 * strings collapse to a safe default rather than erroring, so a bad `?mode=` can never
 * reach a query. Cursor parsing stays in the endpoint (it needs framework error()).
 */
import type { FeedMode, TopWindow } from './types';

const MODES: readonly FeedMode[] = ['new', 'hot', 'top', 'following'];
const WINDOWS: readonly TopWindow[] = ['day', 'week', 'all'];

/** A recognised feed mode, or 'new' for anything unknown/missing. */
export function parseFeedMode(raw: string | null): FeedMode {
	return MODES.includes(raw as FeedMode) ? (raw as FeedMode) : 'new';
}

/** A recognised Top window, or 'day' for anything unknown/missing. */
export function parseTopWindow(raw: string | null): TopWindow {
	return WINDOWS.includes(raw as TopWindow) ? (raw as TopWindow) : 'day';
}
