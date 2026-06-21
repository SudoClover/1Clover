import { describe, it, expect } from 'vitest';
import {
	MAX_IMAGE_BYTES,
	MAX_IMAGE_DIMENSION,
	sniffImageFormat,
	looksLikeMarkup,
	normalizeMime,
	validateDeclaredUpload,
	validateImageBytes,
	validateImageDimensions
} from './index';

// Minimal valid magic-byte headers for each accepted format.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const GIF89 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0]);
const GIF87 = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0, 0]);
const WEBP = new Uint8Array([
	0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
]);
const bytesOf = (s: string) => new TextEncoder().encode(s);

describe('sniffImageFormat (magic bytes)', () => {
	it('detects the allowlisted raster formats', () => {
		expect(sniffImageFormat(PNG)).toBe('png');
		expect(sniffImageFormat(JPEG)).toBe('jpeg');
		expect(sniffImageFormat(GIF87)).toBe('gif');
		expect(sniffImageFormat(GIF89)).toBe('gif');
		expect(sniffImageFormat(WEBP)).toBe('webp');
	});

	it('returns null for non-images and truncated headers', () => {
		expect(sniffImageFormat(bytesOf('not an image'))).toBeNull();
		expect(sniffImageFormat(new Uint8Array([0x89, 0x50]))).toBeNull(); // truncated PNG
		expect(sniffImageFormat(new Uint8Array(0))).toBeNull();
		// RIFF without WEBP (e.g. a WAV) is not accepted as an image.
		expect(
			sniffImageFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))
		).toBeNull();
	});
});

describe('looksLikeMarkup (SVG/XML/HTML guard)', () => {
	it('flags SVG and XML, including with BOM or leading whitespace', () => {
		expect(looksLikeMarkup(bytesOf('<svg xmlns="..."></svg>'))).toBe(true);
		expect(looksLikeMarkup(bytesOf('<?xml version="1.0"?><svg/>'))).toBe(true);
		expect(looksLikeMarkup(bytesOf('  \n\t<svg/>'))).toBe(true);
		expect(looksLikeMarkup(new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x73, 0x76, 0x67]))).toBe(true);
		expect(looksLikeMarkup(bytesOf('<!DOCTYPE html>'))).toBe(true);
	});

	it('does not flag real raster headers', () => {
		expect(looksLikeMarkup(PNG)).toBe(false);
		expect(looksLikeMarkup(JPEG)).toBe(false);
		expect(looksLikeMarkup(WEBP)).toBe(false);
	});
});

describe('normalizeMime', () => {
	it('lowercases, strips params, folds jpg → jpeg', () => {
		expect(normalizeMime('IMAGE/PNG')).toBe('image/png');
		expect(normalizeMime('image/jpeg; charset=binary')).toBe('image/jpeg');
		expect(normalizeMime('image/jpg')).toBe('image/jpeg');
	});
});

describe('validateDeclaredUpload (pre-check)', () => {
	it('accepts allowlisted types within the size cap', () => {
		const r = validateDeclaredUpload({ mimeType: 'image/png', byteSize: 1024 });
		expect(r).toEqual({ ok: true, format: 'png', mimeType: 'image/png' });
	});

	it('normalizes the declared type', () => {
		expect(validateDeclaredUpload({ mimeType: 'image/jpg', byteSize: 1 }).ok).toBe(true);
	});

	it('bans SVG explicitly', () => {
		expect(validateDeclaredUpload({ mimeType: 'image/svg+xml', byteSize: 10 })).toEqual({
			ok: false,
			reason: 'svg_banned'
		});
	});

	it('refuses unsupported types, empty, and oversized', () => {
		expect(validateDeclaredUpload({ mimeType: 'application/pdf', byteSize: 10 }).ok).toBe(false);
		expect(validateDeclaredUpload({ mimeType: 'image/png', byteSize: 0 })).toEqual({
			ok: false,
			reason: 'empty'
		});
		expect(
			validateDeclaredUpload({ mimeType: 'image/png', byteSize: MAX_IMAGE_BYTES + 1 })
		).toEqual({
			ok: false,
			reason: 'too_large'
		});
	});
});

describe('validateImageBytes (authoritative content check)', () => {
	it('accepts each format when the declared type matches', () => {
		expect(validateImageBytes({ declaredMime: 'image/png', bytes: PNG })).toEqual({
			ok: true,
			format: 'png',
			mimeType: 'image/png'
		});
		expect(validateImageBytes({ declaredMime: 'image/jpeg', bytes: JPEG }).ok).toBe(true);
		expect(validateImageBytes({ declaredMime: 'image/webp', bytes: WEBP }).ok).toBe(true);
		expect(validateImageBytes({ declaredMime: 'image/gif', bytes: GIF89 }).ok).toBe(true);
		// jpg → jpeg folding still matches the sniffed jpeg.
		expect(validateImageBytes({ declaredMime: 'image/jpg', bytes: JPEG }).ok).toBe(true);
	});

	it('rejects a declared/actual mismatch (spoofed Content-Type / polyglot)', () => {
		expect(validateImageBytes({ declaredMime: 'image/jpeg', bytes: PNG })).toEqual({
			ok: false,
			reason: 'magic_mismatch'
		});
	});

	it('bans SVG even when the declared type lies about being a raster image', () => {
		const svg = bytesOf('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
		expect(validateImageBytes({ declaredMime: 'image/svg+xml', bytes: svg })).toEqual({
			ok: false,
			reason: 'svg_banned'
		});
		expect(validateImageBytes({ declaredMime: 'image/png', bytes: svg })).toEqual({
			ok: false,
			reason: 'svg_banned'
		});
	});

	it('refuses empty, unknown, and oversized payloads', () => {
		expect(validateImageBytes({ declaredMime: 'image/png', bytes: new Uint8Array(0) })).toEqual({
			ok: false,
			reason: 'empty'
		});
		expect(validateImageBytes({ declaredMime: 'image/png', bytes: bytesOf('plain text') })).toEqual(
			{ ok: false, reason: 'unsupported_type' }
		);
		const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
		huge.set(PNG, 0);
		expect(validateImageBytes({ declaredMime: 'image/png', bytes: huge })).toEqual({
			ok: false,
			reason: 'too_large'
		});
	});
});

describe('validateImageDimensions (decompression-bomb guard)', () => {
	it('accepts normal and boundary dimensions', () => {
		expect(validateImageDimensions(100, 100)).toEqual({ ok: true });
		expect(validateImageDimensions(MAX_IMAGE_DIMENSION, 1)).toEqual({ ok: true });
	});

	it('refuses an over-long side', () => {
		expect(validateImageDimensions(MAX_IMAGE_DIMENSION + 1, 1)).toEqual({
			ok: false,
			reason: 'dimension_exceeded'
		});
		expect(validateImageDimensions(1, MAX_IMAGE_DIMENSION + 1)).toEqual({
			ok: false,
			reason: 'dimension_exceeded'
		});
	});

	it('refuses an over-large pixel count even when each side is in range', () => {
		// 8000 × 6000 = 48 MP > 40 MP cap, both sides < 12000.
		expect(validateImageDimensions(8000, 6000)).toEqual({
			ok: false,
			reason: 'too_many_pixels'
		});
	});
});
