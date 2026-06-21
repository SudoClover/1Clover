/**
 * Cloudflare binding shapes the SvelteKit Worker uses at runtime (via `platform.env`)
 * and the consumer Worker receives as `env`. Structural types so the app needs no
 * `@cloudflare/workers-types` dependency. Bindings are absent in local dev/CI.
 */
import type { MediaJob } from './pipeline';
import type { R2BucketLike } from './store-r2';

export interface MediaQueue {
	send(message: MediaJob): Promise<void>;
}

export interface MediaBindings {
	MEDIA_QUEUE?: MediaQueue;
	MEDIA_BUCKET?: R2BucketLike;
}
