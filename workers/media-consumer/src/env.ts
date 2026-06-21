/**
 * Bindings + secrets the consumer Worker receives as `env` (ADR-0007/0012). R2 +
 * Supabase are required to process; IMAGES (Cloudflare Images) is the prod image
 * processor, wired at the deploy gate. Secrets are set via `wrangler secret`.
 */
import type { R2BucketLike } from '../../../src/lib/server/media/store-r2';

/** Minimal shape of the Cloudflare Images binding the prod processor will use. */
export interface ImagesBinding {
	input(bytes: Uint8Array): unknown;
}

export interface ConsumerEnv {
	MEDIA_BUCKET: R2BucketLike;
	SUPABASE_URL: string;
	SUPABASE_SECRET_KEY: string;
	IMAGES?: ImagesBinding;
}
