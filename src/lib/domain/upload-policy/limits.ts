/**
 * Upload-policy constants and result types (ARCHITECTURE §5, ADR-0007).
 * Pure data — no I/O, no framework. Slice 2 is IMAGE ONLY; audio/video caps are
 * added when those kinds reach the roadmap.
 */

/** Raster formats we accept. SVG is deliberately absent — it is banned. */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif';

/** Canonical MIME for each accepted format (the only values we trust on output). */
export const ALLOWED_IMAGE_MIME: Readonly<Record<ImageFormat, string>> = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif'
};

/** Hard caps enforced BEFORE any heavy processing (decompression-bomb guard). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB on the wire
export const MAX_IMAGE_PIXELS = 40_000_000; // 40 MP decoded (width × height)
export const MAX_IMAGE_DIMENSION = 12_000; // px on either side

/** Why an upload was refused. Surfaced to the uploader; never a silent pass. */
export type RejectReason =
	| 'empty'
	| 'unsupported_type'
	| 'svg_banned'
	| 'magic_mismatch'
	| 'too_large'
	| 'dimension_exceeded'
	| 'too_many_pixels';

/** A content check either passes with a trusted format, or refuses with a reason. */
export type PolicyResult =
	| { ok: true; format: ImageFormat; mimeType: string }
	| { ok: false; reason: RejectReason };

/** Dimension checks have no format to return — just pass/refuse. */
export type DimensionResult = { ok: true } | { ok: false; reason: RejectReason };
