/**
 * URL for a stored media variant key. Slice 2 serves variants from /media/[...key];
 * at deploy this becomes a signed R2/CDN URL (ADR-0003) — callers don't change.
 */
export function variantUrl(key: string): string {
	return `/media/${key}`;
}
