/**
 * Magic-byte sniffing for the upload allowlist (CLAUDE.md §4.7).
 * We trust the FILE CONTENT, never the extension or declared Content-Type. Pure
 * functions over the first bytes of a file — unit-tested with crafted buffers.
 */
import type { ImageFormat } from './limits';

/** Bytes a raster header is found within; nothing useful lives past this offset. */
const HEADER_WINDOW = 16;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
	if (bytes.length < offset + signature.length) return false;
	return signature.every((b, i) => bytes[offset + i] === b);
}

/**
 * Detect the real raster format from leading magic bytes, or null if it is not a
 * format on our allowlist. A valid raster header NEVER starts with '<' (markup),
 * so SVG/HTML polyglots fall through to null here and are caught by looksLikeMarkup.
 */
export function sniffImageFormat(bytes: Uint8Array): ImageFormat | null {
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
	// JPEG: FF D8 FF
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
	// GIF: "GIF87a" or "GIF89a"
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])) return 'gif';
	if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return 'gif';
	// WebP: "RIFF" .... "WEBP"
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
	) {
		return 'webp';
	}
	return null;
}

/**
 * True if the first meaningful byte is '<' — i.e. the payload is XML/SVG/HTML-like
 * markup, not a raster image. Skips a UTF-8 BOM and leading whitespace so that
 * "  \n<svg>" and a BOM-prefixed "<?xml" are both caught. SVG is banned outright.
 */
export function looksLikeMarkup(bytes: Uint8Array): boolean {
	let i = 0;
	// UTF-8 BOM
	if (startsWith(bytes, [0xef, 0xbb, 0xbf])) i = 3;
	const whitespace = new Set([0x20, 0x09, 0x0a, 0x0d, 0x0c, 0x0b]);
	while (i < bytes.length && i < HEADER_WINDOW) {
		const byte = bytes[i];
		if (byte === undefined || !whitespace.has(byte)) break;
		i++;
	}
	return bytes[i] === 0x3c; // '<'
}

/** Lowercase, strip parameters, fold image/jpg → image/jpeg. */
export function normalizeMime(mimeType: string): string {
	const base = (mimeType.split(';')[0] ?? '').trim().toLowerCase();
	return base === 'image/jpg' ? 'image/jpeg' : base;
}
