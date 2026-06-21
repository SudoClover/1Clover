/**
 * Cloudflare Images processor for the prod consumer Worker (ADR-0007/0012) — sharp
 * cannot run in workerd, so the prod re-encode/thumbnail uses the Images binding.
 *
 * DEFERRED to the deploy gate: enabling Cloudflare Images is a 💳/#2 step, so this
 * is not wired yet. It throws clearly if invoked without the binding, rather than
 * silently passing untransformed bytes. The pipeline + tests use injected processors
 * (sharp in Node, a stub in the workers test), so nothing depends on this in CI.
 */
import type { ImageProcessor } from '../../../src/lib/server/media/pipeline';
import type { ImagesBinding } from './env';

export function createImagesProcessor(images: ImagesBinding | undefined): ImageProcessor {
	const notWired = () => {
		throw new Error('Cloudflare Images is not enabled yet (deferred to the deploy gate).');
	};
	if (!images) {
		return { probe: notWired, reencode: notWired, thumbnail: notWired };
	}
	// Real Images transforms are implemented when the binding is enabled at deploy.
	return { probe: notWired, reencode: notWired, thumbnail: notWired };
}
