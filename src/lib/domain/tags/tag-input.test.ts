import { describe, expect, it } from 'vitest';
import { MAX_TAGS_PER_POST, TAG_MAX_LEN, TAG_RE, normalizeTags, validateTags } from './tag-input';

describe('normalizeTags', () => {
	it('lowercases, trims, and hyphenates internal whitespace', () => {
		expect(normalizeTags('Pixel Art, RETRO ,  Sci  Fi ')).toEqual(['pixel-art', 'retro', 'sci-fi']);
	});

	it('splits on commas and hyphenates internal whitespace within a tag', () => {
		expect(normalizeTags('a b,c\td')).toEqual(['a-b', 'c-d']);
	});

	it('strips characters outside [a-z0-9-] and collapses hyphen runs', () => {
		expect(normalizeTags('c++, hello---world, --edge--')).toEqual(['c', 'hello-world', 'edge']);
	});

	it('de-duplicates, preserving first-seen order', () => {
		expect(normalizeTags('cat, Cat,  CAT , dog')).toEqual(['cat', 'dog']);
	});

	it('drops empty/garbage-only tokens', () => {
		expect(normalizeTags('  , !!! , ---, ,')).toEqual([]);
	});

	it('only ever emits tokens that satisfy the DB charset (when ≤ max length)', () => {
		for (const tag of normalizeTags('Pixel Art, c++, 2024, hello---world')) {
			expect(TAG_RE.test(tag)).toBe(true);
		}
	});
});

describe('validateTags', () => {
	it('accepts a clean set with no error', () => {
		expect(validateTags('art, pixel, retro')).toEqual({
			value: ['art', 'pixel', 'retro'],
			error: null
		});
	});

	it('flags a tag that exceeds the length cap', () => {
		const long = 'x'.repeat(TAG_MAX_LEN + 1);
		const result = validateTags(long);
		expect(result.error).toMatch(/at most/);
	});

	it('caps the count and reports it', () => {
		const raw = Array.from({ length: MAX_TAGS_PER_POST + 3 }, (_, i) => `t${i}`).join(', ');
		const result = validateTags(raw);
		expect(result.value).toHaveLength(MAX_TAGS_PER_POST);
		expect(result.error).toMatch(/at most/);
	});

	it('treats an empty field as zero tags, no error', () => {
		expect(validateTags('   ')).toEqual({ value: [], error: null });
	});
});
