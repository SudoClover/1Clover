/**
 * Shared, pure contracts for the feeds (ARCHITECTURE.md §4.2 — Slice 5). Safe to import
 * on the client (no server-only code). The four feed modes share the same `BoardCard`
 * render shape (see `../posts/types`); they differ only in ordering + cursor.
 *
 * - New / Top / Following keyset on (created_at, id)  → reuse `BoardCursor`.
 * - Hot keyset on (hot_score, id)                     → `HotCursor`.
 */

// Re-exported so feed consumers (routes/UI) import every cursor type from one place.
export type { BoardCursor } from '../posts/types';

export type FeedMode = 'new' | 'hot' | 'top' | 'following';

/** Top is windowed: highest-ranked posts created within the window. */
export type TopWindow = 'day' | 'week' | 'all';

/** Keyset cursor for the Hot feed — just the last card's id. The (hot_score, id) boundary
 *  is resolved server-side in SQL, because PostgREST truncates float8 so a hot_score can't
 *  round-trip through the client (it would dup/skip rows at page edges). */
export interface HotCursor {
	id: string;
}
