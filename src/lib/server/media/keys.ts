/**
 * Server-generated R2 object keys + checksum. Keys are derived from the owner id
 * and the media row id — NEVER the user's filename (CLAUDE.md §4.7). The original
 * upload, the re-encoded "safe" copy, and the thumbnail each get a distinct key;
 * only the safe/thumb variants are ever served.
 */

// Keys are namespaced by owner + media id; the bucket is media-dedicated, so no
// extra prefix is needed (avoids a redundant segment in the served `/media/<key>` URL).
export function originalKey(ownerId: string, mediaId: string): string {
	return `${ownerId}/${mediaId}/original`;
}

export function safeKey(ownerId: string, mediaId: string): string {
	return `${ownerId}/${mediaId}/safe.webp`;
}

export function thumbKey(ownerId: string, mediaId: string): string {
	return `${ownerId}/${mediaId}/thumb.webp`;
}

/** Hex sha256 of the safe bytes — uses Web Crypto (present in Node 20+ and workerd). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
	// Copy into a plain ArrayBuffer-backed view so the WebCrypto BufferSource type
	// is satisfied (TS's Uint8Array is generic over ArrayBufferLike).
	const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
