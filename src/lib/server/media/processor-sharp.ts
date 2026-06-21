/**
 * sharp (libvips) image processor for Node — LOCAL DEV + CI (ADR-0012). sharp is a
 * native addon and CANNOT run in workerd, so this never reaches the prod Worker
 * bundle (the prod ImageProcessor is the Cloudflare Images binding, wired at deploy).
 *
 * Re-encoding to WebP strips all metadata (EXIF/ICC/XMP) and neutralizes embedded
 * payloads — the served "safe" copy. `failOn: 'error'` makes corrupt input throw, so
 * the pipeline marks it `failed` rather than serving garbage. Animation is flattened
 * to the first frame (acceptable for the Slice 2 image spine).
 */
import sharp from 'sharp';
import type { ImageProcessor } from './pipeline';

const THUMB_MAX = 512;

export const sharpProcessor: ImageProcessor = {
	async probe(bytes: Uint8Array): Promise<{ width: number; height: number }> {
		const meta = await sharp(bytes).metadata();
		return { width: meta.width ?? 0, height: meta.height ?? 0 };
	},

	async reencode(bytes: Uint8Array): Promise<{ bytes: Uint8Array; mimeType: string }> {
		const out = await sharp(bytes, { failOn: 'error' })
			.rotate() // bake in EXIF orientation before metadata is dropped
			.webp({ quality: 82 })
			.toBuffer();
		return { bytes: new Uint8Array(out), mimeType: 'image/webp' };
	},

	async thumbnail(bytes: Uint8Array): Promise<{ bytes: Uint8Array; mimeType: string }> {
		const out = await sharp(bytes, { failOn: 'error' })
			.rotate()
			.resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 80 })
			.toBuffer();
		return { bytes: new Uint8Array(out), mimeType: 'image/webp' };
	}
};
