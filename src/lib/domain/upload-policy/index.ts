/**
 * Upload policy — the pure decision layer for what may be uploaded (ARCHITECTURE
 * §5/§9, ADR-0007). No I/O, no framework: every rule is a unit-testable function.
 *
 * Two checkpoints:
 *  1. validateDeclaredUpload — cheap pre-check at the /api/upload slot request
 *     (declared MIME + size), before any bytes exist. UX + early refusal.
 *  2. validateImageBytes / validateImageDimensions — the REAL checks in the
 *     pipeline, over actual bytes and decoded dimensions. These gate processing.
 *
 * The strongest anti-polyglot guarantee is the consumer's re-encode (it rewrites
 * the file to a canonical raster, neutralizing any embedded payload). This module
 * enforces the allowlist, the SVG ban, the declared/actual match, and the caps.
 */
import {
	ALLOWED_IMAGE_MIME,
	MAX_IMAGE_BYTES,
	MAX_IMAGE_DIMENSION,
	MAX_IMAGE_PIXELS,
	type DimensionResult,
	type ImageFormat,
	type PolicyResult
} from './limits';
import { looksLikeMarkup, normalizeMime, sniffImageFormat } from './magic-bytes';

export * from './limits';
export { sniffImageFormat, looksLikeMarkup, normalizeMime } from './magic-bytes';

function formatForMime(mimeType: string): ImageFormat | null {
	const normalized = normalizeMime(mimeType);
	const entry = (Object.entries(ALLOWED_IMAGE_MIME) as [ImageFormat, string][]).find(
		([, mime]) => mime === normalized
	);
	return entry ? entry[0] : null;
}

/** Pre-check from the DECLARED type + size only (no bytes yet). */
export function validateDeclaredUpload(input: {
	mimeType: string;
	byteSize: number;
}): PolicyResult {
	if (normalizeMime(input.mimeType) === 'image/svg+xml') return { ok: false, reason: 'svg_banned' };

	const format = formatForMime(input.mimeType);
	if (!format) return { ok: false, reason: 'unsupported_type' };

	if (input.byteSize <= 0) return { ok: false, reason: 'empty' };
	if (input.byteSize > MAX_IMAGE_BYTES) return { ok: false, reason: 'too_large' };

	return { ok: true, format, mimeType: ALLOWED_IMAGE_MIME[format] };
}

/** The authoritative content check, over real bytes. */
export function validateImageBytes(input: {
	declaredMime: string;
	bytes: Uint8Array;
}): PolicyResult {
	const { bytes } = input;
	if (bytes.length === 0) return { ok: false, reason: 'empty' };
	if (looksLikeMarkup(bytes)) return { ok: false, reason: 'svg_banned' };
	if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: 'too_large' };

	const format = sniffImageFormat(bytes);
	if (!format) return { ok: false, reason: 'unsupported_type' };

	// The declared type must match what the bytes actually are (mismatch ⇒ polyglot/
	// spoofed Content-Type). The canonical MIME — not the declared one — is returned.
	if (normalizeMime(input.declaredMime) !== ALLOWED_IMAGE_MIME[format]) {
		return { ok: false, reason: 'magic_mismatch' };
	}

	return { ok: true, format, mimeType: ALLOWED_IMAGE_MIME[format] };
}

/** Decoded-dimension caps — run once the decoder reports width/height. */
export function validateImageDimensions(width: number, height: number): DimensionResult {
	if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
		return { ok: false, reason: 'dimension_exceeded' };
	}
	if (width * height > MAX_IMAGE_PIXELS) return { ok: false, reason: 'too_many_pixels' };
	return { ok: true };
}
