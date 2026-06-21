import { describe, it, expect } from 'vitest';
import {
	validatePostInput,
	validatePostEdit,
	TITLE_MAX,
	DESCRIPTION_MAX,
	MAX_MEDIA_PER_POST
} from './post-input';

const UUID = '11111111-1111-1111-1111-111111111111';
const UUID2 = '22222222-2222-2222-2222-222222222222';

describe('validatePostInput', () => {
	it('accepts a valid post and trims the title', () => {
		const { value, errors } = validatePostInput({
			title: '  Hello  ',
			description: '  a note  ',
			mediaIds: [UUID]
		});
		expect(errors).toEqual([]);
		expect(value.title).toBe('Hello');
		expect(value.description).toBe('a note');
		expect(value.mediaIds).toEqual([UUID]);
	});

	it('collapses an empty/whitespace description to null', () => {
		expect(
			validatePostInput({ title: 'x', description: '   ', mediaIds: [UUID] }).value.description
		).toBeNull();
		expect(validatePostInput({ title: 'x', mediaIds: [UUID] }).value.description).toBeNull();
	});

	it('de-duplicates media ids, preserving order', () => {
		const { value } = validatePostInput({ title: 'x', mediaIds: [UUID, UUID2, UUID] });
		expect(value.mediaIds).toEqual([UUID, UUID2]);
	});

	it('requires a non-empty title', () => {
		expect(validatePostInput({ title: '   ', mediaIds: [UUID] }).errors[0]?.field).toBe('title');
	});

	it('rejects an over-long title', () => {
		const errors = validatePostInput({ title: 'a'.repeat(TITLE_MAX + 1), mediaIds: [UUID] }).errors;
		expect(errors.some((e) => e.field === 'title')).toBe(true);
	});

	it('rejects an over-long description', () => {
		const errors = validatePostInput({
			title: 'x',
			description: 'a'.repeat(DESCRIPTION_MAX + 1),
			mediaIds: [UUID]
		}).errors;
		expect(errors.some((e) => e.field === 'description')).toBe(true);
	});

	it('requires at least one media id', () => {
		expect(validatePostInput({ title: 'x', mediaIds: [] }).errors[0]?.field).toBe('media');
	});

	it('rejects more than the media cap', () => {
		const many = Array.from(
			{ length: MAX_MEDIA_PER_POST + 1 },
			(_, i) => `${i}`.padStart(8, '0') + '-1111-1111-1111-111111111111'
		);
		expect(
			validatePostInput({ title: 'x', mediaIds: many }).errors.some((e) => e.field === 'media')
		).toBe(true);
	});

	it('rejects a non-uuid media id', () => {
		expect(
			validatePostInput({ title: 'x', mediaIds: ['not-a-uuid'] }).errors.some(
				(e) => e.field === 'media'
			)
		).toBe(true);
	});
});

describe('validatePostEdit', () => {
	it('accepts valid fields and ignores media', () => {
		const { value, errors } = validatePostEdit({ title: 'New title', description: 'desc' });
		expect(errors).toEqual([]);
		expect(value).toEqual({ title: 'New title', description: 'desc' });
	});

	it('flags an empty title', () => {
		expect(validatePostEdit({ title: '' }).errors[0]?.field).toBe('title');
	});
});
