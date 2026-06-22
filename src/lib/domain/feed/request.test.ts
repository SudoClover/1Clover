import { describe, expect, it } from 'vitest';
import { parseFeedMode, parseTopWindow } from './request';

describe('parseFeedMode', () => {
	it('accepts each known mode', () => {
		expect(parseFeedMode('new')).toBe('new');
		expect(parseFeedMode('hot')).toBe('hot');
		expect(parseFeedMode('top')).toBe('top');
		expect(parseFeedMode('following')).toBe('following');
	});

	it('falls back to new for unknown or missing input', () => {
		expect(parseFeedMode('bogus')).toBe('new');
		expect(parseFeedMode(null)).toBe('new');
		expect(parseFeedMode('')).toBe('new');
	});
});

describe('parseTopWindow', () => {
	it('accepts each known window', () => {
		expect(parseTopWindow('day')).toBe('day');
		expect(parseTopWindow('week')).toBe('week');
		expect(parseTopWindow('all')).toBe('all');
	});

	it('falls back to day for unknown or missing input', () => {
		expect(parseTopWindow('year')).toBe('day');
		expect(parseTopWindow(null)).toBe('day');
	});
});
