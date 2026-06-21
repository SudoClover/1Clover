/**
 * R2-binding object store (ADR-0003/0012) — the prod + Worker implementation of
 * MediaStore. Uses a structural R2 type so the app lib needs no Cloudflare types
 * dependency; the consumer Worker passes its real `env.MEDIA_BUCKET` binding.
 * Contains no Node APIs, so it is safe in the workerd bundle.
 */
import type { MediaStore } from './pipeline';

interface R2ObjectBodyLike {
	arrayBuffer(): Promise<ArrayBuffer>;
}
export interface R2BucketLike {
	get(key: string): Promise<R2ObjectBodyLike | null>;
	put(key: string, value: ArrayBuffer | Uint8Array): Promise<unknown>;
}

export function createR2Store(bucket: R2BucketLike): MediaStore {
	return {
		async get(key: string): Promise<Uint8Array | null> {
			const object = await bucket.get(key);
			if (!object) return null;
			return new Uint8Array(await object.arrayBuffer());
		},
		async put(key: string, bytes: Uint8Array): Promise<void> {
			await bucket.put(key, bytes);
		}
	};
}
