/**
 * Pure window selectors for the Top feed (ARCHITECTURE.md §4.2 — Slice 5). Given a
 * window and "now", return the ISO lower bound for `created_at`, or null for 'all'
 * (no lower bound). Pure + deterministic so it can be tested with a fixed clock.
 */
import type { TopWindow } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

const WINDOW_MS: Record<Exclude<TopWindow, 'all'>, number> = {
	day: DAY_MS,
	week: 7 * DAY_MS
};

/** ISO timestamp the Top window starts at, or null for the all-time window. */
export function windowStart(window: TopWindow, nowMs: number): string | null {
	if (window === 'all') return null;
	return new Date(nowMs - WINDOW_MS[window]).toISOString();
}
