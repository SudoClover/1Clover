import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
	runMediaPipeline,
	type ImageProcessor,
	type MediaSink,
	type ReadyFields
} from '../../../src/lib/server/media/pipeline';
import { createR2Store, type R2BucketLike } from '../../../src/lib/server/media/store-r2';
import { stubClassifier } from '../../../src/lib/server/media/classify';
import { safeKey, thumbKey } from '../../../src/lib/server/media/keys';

// REAL R2 binding via miniflare (ADR-0012). sharp can't run in workerd, so the image
// transform is a stub; this proves the binding glue — read original from R2, write
// the safe + thumb copies back to R2, and report the terminal state to the sink.
const bucket = (env as unknown as { MEDIA_BUCKET: R2BucketLike }).MEDIA_BUCKET;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

const stubProcessor: ImageProcessor = {
	async probe() {
		return { width: 4, height: 3 };
	},
	async reencode() {
		return { bytes: WEBP, mimeType: 'image/webp' };
	},
	async thumbnail() {
		return { bytes: WEBP, mimeType: 'image/webp' };
	}
};

function recordingSink() {
	const ready: { id: string; fields: ReadyFields }[] = [];
	const failed: { id: string; reason: string }[] = [];
	const sink: MediaSink = {
		markReady: async (id, fields) => {
			ready.push({ id, fields });
		},
		markFailed: async (id, reason) => {
			failed.push({ id, reason });
		}
	};
	return { sink, ready, failed };
}

describe('media consumer (workerd, real R2 binding)', () => {
	it('reads the original from R2, writes safe+thumb back, marks approved', async () => {
		const store = createR2Store(bucket);
		const { sink, ready, failed } = recordingSink();
		const job = {
			mediaId: crypto.randomUUID(),
			ownerId: 'owner1',
			storageKey: 'media/owner1/seed/original',
			declaredMime: 'image/png'
		};
		await store.put(job.storageKey, PNG);

		const outcome = await runMediaPipeline(job, {
			store,
			processor: stubProcessor,
			classify: stubClassifier,
			sink
		});

		expect(outcome.state).toBe('approved');
		expect(failed).toHaveLength(0);
		expect(ready).toHaveLength(1);
		expect(ready[0]?.fields.moderation).toBe('approved');
		expect(ready[0]?.fields.variants.safe).toBe(safeKey('owner1', job.mediaId));

		// The safe + thumb objects really landed in the R2 binding; the original too.
		expect(await bucket.get(safeKey('owner1', job.mediaId))).not.toBeNull();
		expect(await bucket.get(thumbKey('owner1', job.mediaId))).not.toBeNull();
		expect(await bucket.get(job.storageKey)).not.toBeNull();
	});

	it('marks a rejected file failed and writes no served variant', async () => {
		const store = createR2Store(bucket);
		const { sink, ready, failed } = recordingSink();
		const svg = new TextEncoder().encode('<svg/>');
		const job = {
			mediaId: crypto.randomUUID(),
			ownerId: 'owner2',
			storageKey: 'media/owner2/seed/original',
			declaredMime: 'image/svg+xml'
		};
		await store.put(job.storageKey, svg);

		const outcome = await runMediaPipeline(job, {
			store,
			processor: stubProcessor,
			classify: stubClassifier,
			sink
		});

		expect(outcome).toEqual({ state: 'failed', reason: 'svg_banned' });
		expect(ready).toHaveLength(0);
		expect(failed).toHaveLength(1);
		expect(await bucket.get(safeKey('owner2', job.mediaId))).toBeNull();
	});
});
