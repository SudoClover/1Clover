/**
 * The media pipeline (ARCHITECTURE §5, ADR-0007/0012) — the one safety choke point
 * every upload passes through. It is dependency-INJECTED: the control flow lives
 * here, the I/O (object store, image processor, classifier, DB sink) is supplied by
 * the caller. So the SAME flow runs in the prod consumer Worker (R2 + Cloudflare
 * Images), the Node dev/inline path (fs + sharp), and tests (fakes) — no branching
 * on environment inside the pipeline.
 *
 * Relative imports (not $lib) so the worker bundle, which has no SvelteKit aliases,
 * can import this file too.
 */
import {
	validateImageBytes,
	validateImageDimensions,
	type RejectReason
} from '../../domain/upload-policy/index';
import { safeKey, thumbKey, sha256Hex } from './keys';

export interface MediaJob {
	mediaId: string;
	ownerId: string;
	/** R2 key of the ORIGINAL upload (server-generated). */
	storageKey: string;
	/** MIME the client claimed; re-checked against magic bytes here. */
	declaredMime: string;
}

/** Object storage (R2 in prod, fs in dev, in-memory in tests). */
export interface MediaStore {
	get(key: string): Promise<Uint8Array | null>;
	put(key: string, bytes: Uint8Array): Promise<void>;
}

/** Image transforms (Cloudflare Images in prod, sharp in Node/dev/tests). */
export interface ImageProcessor {
	/** Cheap metadata read (no full decode) for the decompression-bomb guard. */
	probe(bytes: Uint8Array): Promise<{ width: number; height: number }>;
	/** Re-encode to a canonical, metadata-stripped raster (the served "safe" copy). */
	reencode(bytes: Uint8Array): Promise<{ bytes: Uint8Array; mimeType: string }>;
	/** A small derived thumbnail. */
	thumbnail(bytes: Uint8Array): Promise<{ bytes: Uint8Array; mimeType: string }>;
}

/** Safety classification — a ROUTING signal, never a verdict (Slice 8 = real AI). */
export type Classifier = (bytes: Uint8Array) => Promise<'clean' | 'suspect'>;

export interface ReadyFields {
	moderation: 'approved' | 'held';
	mimeType: string;
	width: number;
	height: number;
	byteSize: number;
	checksum: string;
	variants: { safe: string; thumb: string };
}

/** Writes the terminal state back to the `media` row (service-role, bypasses RLS). */
export interface MediaSink {
	markReady(mediaId: string, fields: ReadyFields): Promise<void>;
	markFailed(mediaId: string, reason: string): Promise<void>;
}

export interface PipelineDeps {
	store: MediaStore;
	processor: ImageProcessor;
	classify: Classifier;
	sink: MediaSink;
}

export type PipelineOutcome =
	| { state: 'approved' | 'held' }
	| { state: 'failed'; reason: RejectReason | 'corrupt' | 'missing' };

async function fail(
	sink: MediaSink,
	mediaId: string,
	reason: RejectReason | 'corrupt' | 'missing'
): Promise<PipelineOutcome> {
	await sink.markFailed(mediaId, reason);
	return { state: 'failed', reason };
}

/**
 * Validate → guard dimensions → re-encode + thumbnail → classify → flip state.
 * A rejected or corrupt file ends `failed` and is never served; a clean file ends
 * `approved`/`ready`; a suspect file ends `held` (invisible, awaiting Slice 8's
 * human queue). The ORIGINAL bytes are never written to a served variant.
 */
export async function runMediaPipeline(
	job: MediaJob,
	deps: PipelineDeps
): Promise<PipelineOutcome> {
	const { store, processor, classify, sink } = deps;

	const bytes = await store.get(job.storageKey);
	if (!bytes || bytes.length === 0) return fail(sink, job.mediaId, 'missing');

	const policy = validateImageBytes({ declaredMime: job.declaredMime, bytes });
	if (!policy.ok) return fail(sink, job.mediaId, policy.reason);

	let dimensions: { width: number; height: number };
	try {
		dimensions = await processor.probe(bytes);
	} catch {
		return fail(sink, job.mediaId, 'corrupt');
	}
	const dim = validateImageDimensions(dimensions.width, dimensions.height);
	if (!dim.ok) return fail(sink, job.mediaId, dim.reason);

	let safe: { bytes: Uint8Array; mimeType: string };
	let thumb: { bytes: Uint8Array; mimeType: string };
	try {
		safe = await processor.reencode(bytes);
		thumb = await processor.thumbnail(bytes);
	} catch {
		return fail(sink, job.mediaId, 'corrupt');
	}

	const safeName = safeKey(job.ownerId, job.mediaId);
	const thumbName = thumbKey(job.ownerId, job.mediaId);
	await store.put(safeName, safe.bytes);
	await store.put(thumbName, thumb.bytes);

	// Classify the SAFE copy (the only bytes we will ever serve).
	const verdict = await classify(safe.bytes);
	const moderation = verdict === 'suspect' ? 'held' : 'approved';

	await sink.markReady(job.mediaId, {
		moderation,
		mimeType: safe.mimeType,
		width: dimensions.width,
		height: dimensions.height,
		byteSize: safe.bytes.length,
		checksum: await sha256Hex(safe.bytes),
		variants: { safe: safeName, thumb: thumbName }
	});
	return { state: moderation };
}
