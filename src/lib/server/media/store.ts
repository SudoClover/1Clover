/**
 * Picks the MediaStore for the current runtime: the R2 binding in prod/Worker, or
 * the Node filesystem store in local dev/CI (ADR-0012). The fs store is loaded by a
 * dynamic import so its `node:fs` dependency never enters the workerd bundle.
 */
import { env } from '$env/dynamic/private';
import { createR2Store, type R2BucketLike } from './store-r2';
import type { MediaStore } from './pipeline';

/** Where the dev fs store keeps objects (git-ignored). */
export const DEV_STORE_DIR = env.MEDIA_STORE_DIR || '.r2-dev';

export async function resolveStore(bucket: R2BucketLike | undefined): Promise<MediaStore> {
	if (bucket) return createR2Store(bucket);
	// No R2 binding ⇒ local dev/CI: use the fs store. In prod the binding is always
	// present; if it were ever missing the fs path fails closed (node:fs in workerd
	// throws) rather than serving from an unintended location.
	const { createFsStore } = await import('./store-fs');
	return createFsStore(DEV_STORE_DIR);
}
