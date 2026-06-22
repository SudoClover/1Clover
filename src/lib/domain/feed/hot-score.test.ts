import { describe, expect, it } from 'vitest';
import { hotScore } from './hot-score';

// One divisor's worth of age, in ms: 45000 s → exactly +1 on the time term.
const HOT_DIVISOR_MS = 45000 * 1000;

describe('hotScore', () => {
	it('ranks a higher score above a lower one at the same time', () => {
		const t = 1_000_000_000_000;
		expect(hotScore(100, t)).toBeGreaterThan(hotScore(10, t));
	});

	it('ranks a newer post above an older one at the same score', () => {
		expect(hotScore(5, 2_000_000_000_000)).toBeGreaterThan(hotScore(5, 1_000_000_000_000));
	});

	it('lets a large score difference overcome an age difference', () => {
		// Older post with score 100 (log10 → 2) beats a newer post (one divisor of age, +1)
		// with score 1 (log10 → 0): 0 + 2 > 1 + 0.
		const older = hotScore(100, 0);
		const newer = hotScore(1, HOT_DIVISOR_MS);
		expect(older).toBeGreaterThan(newer);
	});

	it('treats score 0 and 1 the same (log10 floors at 1), so Hot reduces to time', () => {
		const t = 1_500_000_000_000;
		expect(hotScore(0, t)).toBe(hotScore(1, t));
		// With no score signal the value is purely the time term — Hot mirrors New.
		expect(hotScore(0, t)).toBeCloseTo(t / 1000 / 45000, 9);
	});

	it('is deterministic for the same inputs', () => {
		expect(hotScore(42, 1_234_567_890_000)).toBe(hotScore(42, 1_234_567_890_000));
	});
});
