import { describe, expect, it } from 'vitest';
import { windowStart } from './windows';

describe('windowStart', () => {
	// A fixed clock so the boundaries are exact (CLAUDE.md §6 — determinism).
	const now = Date.parse('2026-06-22T12:00:00.000Z');

	it('returns 24h before now for the day window', () => {
		expect(windowStart('day', now)).toBe('2026-06-21T12:00:00.000Z');
	});

	it('returns 7 days before now for the week window', () => {
		expect(windowStart('week', now)).toBe('2026-06-15T12:00:00.000Z');
	});

	it('returns null (no lower bound) for the all-time window', () => {
		expect(windowStart('all', now)).toBeNull();
	});
});
