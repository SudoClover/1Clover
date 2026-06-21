import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Database } from '../../src/lib/types/database';
import { runMediaPipeline, type PipelineDeps } from '../../src/lib/server/media/pipeline';
import { sharpProcessor } from '../../src/lib/server/media/processor-sharp';
import { stubClassifier } from '../../src/lib/server/media/classify';
import { createFsStore } from '../../src/lib/server/media/store-fs';
import {
	createAdminClient,
	createMediaRow,
	createMediaSink
} from '../../src/lib/server/media/repo';
import { originalKey } from '../../src/lib/server/media/keys';

// Runs against LOCAL Supabase + real sharp + a temp fs object store (CLAUDE.md §6 —
// never mock the DB). This is the real proof of the Slice 2 pipeline (ADR-0012).
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const PUBLISHABLE = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

const admin = createAdminClient(URL, SECRET);
const anon = () => createClient<Database>(URL, PUBLISHABLE, { auth: { persistSession: false } });

let storeDir: string;
let store: ReturnType<typeof createFsStore>;
let deps: PipelineDeps;
let ownerId: string;

async function pngBytes(): Promise<Uint8Array> {
	const buf = await sharp({
		create: { width: 12, height: 8, channels: 3, background: { r: 200, g: 30, b: 60 } }
	})
		.png()
		.toBuffer();
	return new Uint8Array(buf);
}

/** Seed a `pending` media row + its original bytes, ready to run the pipeline. */
async function seed(bytes: Uint8Array, mime: string) {
	const mediaId = crypto.randomUUID();
	const storageKey = originalKey(ownerId, mediaId);
	await store.put(storageKey, bytes);
	await createMediaRow(admin, {
		mediaId,
		ownerId,
		storageKey,
		format: 'png',
		mimeType: mime,
		byteSize: bytes.length
	});
	return { mediaId, ownerId, storageKey, declaredMime: mime };
}

async function rowOf(mediaId: string) {
	const { data } = await admin.from('media').select('*').eq('id', mediaId).single();
	return data;
}

beforeAll(async () => {
	const { data, error } = await admin.auth.admin.createUser({
		email: `media_${Date.now().toString(36)}@example.test`,
		password: 'password123',
		email_confirm: true,
		user_metadata: { username: `media_${Date.now().toString(36)}` }
	});
	if (error) throw error;
	ownerId = data.user.id;

	storeDir = await mkdtemp(join(tmpdir(), 'clover-media-'));
	store = createFsStore(storeDir);
	deps = {
		store,
		processor: sharpProcessor,
		classify: stubClassifier,
		sink: createMediaSink(admin)
	};
});

afterAll(async () => {
	await admin.auth.admin.deleteUser(ownerId);
	await rm(storeDir, { recursive: true, force: true });
});

describe('media pipeline (integration)', () => {
	it('approves a valid image: ready + approved, with safe/thumb variants', async () => {
		const job = await seed(await pngBytes(), 'image/png');
		const outcome = await runMediaPipeline(job, deps);
		expect(outcome.state).toBe('approved');

		const row = await rowOf(job.mediaId);
		expect(row?.processing_state).toBe('ready');
		expect(row?.moderation_state).toBe('approved');
		expect(row?.width).toBe(12);
		expect(row?.height).toBe(8);
		expect(row?.mime_type).toBe('image/webp');
		expect(row?.checksum).toMatch(/^[0-9a-f]{64}$/);

		const variants = row?.variants as { safe?: string; thumb?: string };
		// Only re-encoded variants are recorded — never the original key.
		expect(variants.safe).toMatch(/\/safe\.webp$/);
		expect(variants.thumb).toMatch(/\/thumb\.webp$/);
		expect(variants.safe).not.toBe(job.storageKey);
		// The safe + thumb objects exist and are real WebP.
		const safe = await store.get(variants.safe as string);
		expect(safe).not.toBeNull();
		expect((await sharp(safe!).metadata()).format).toBe('webp');
	});

	it('fails an SVG (banned), never approving it', async () => {
		const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
		const job = await seed(svg, 'image/svg+xml');
		const outcome = await runMediaPipeline(job, deps);
		expect(outcome).toEqual({ state: 'failed', reason: 'svg_banned' });

		const row = await rowOf(job.mediaId);
		expect(row?.processing_state).toBe('failed');
		expect(row?.moderation_state).not.toBe('approved');
	});

	it('fails a declared/actual mismatch (spoofed Content-Type)', async () => {
		const jpeg = new Uint8Array(
			await sharp(await pngBytes())
				.jpeg()
				.toBuffer()
		);
		const job = await seed(jpeg, 'image/png'); // claims PNG, bytes are JPEG
		const outcome = await runMediaPipeline(job, deps);
		expect(outcome).toEqual({ state: 'failed', reason: 'magic_mismatch' });
		expect((await rowOf(job.mediaId))?.processing_state).toBe('failed');
	});

	it('fails a corrupt image (valid header, undecodable body)', async () => {
		// Real PNG magic so it passes the byte allowlist, but garbage afterwards so the
		// decoder/probe throws — exercises the `corrupt` path end-to-end.
		const corrupt = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6
		]);
		const job = await seed(corrupt, 'image/png');
		const outcome = await runMediaPipeline(job, deps);
		expect(outcome.state).toBe('failed');

		const row = await rowOf(job.mediaId);
		expect(row?.processing_state).toBe('failed');
		expect(row?.moderation_state).not.toBe('approved');
	});

	it('keeps pending media private to its owner; shows approved to everyone', async () => {
		// A pending (unprocessed) row is invisible to anonymous readers.
		const pending = await seed(await pngBytes(), 'image/png');
		const { data: anonPending } = await anon().from('media').select('id').eq('id', pending.mediaId);
		expect(anonPending).toEqual([]);

		// Once approved, anyone can read it.
		const approved = await seed(await pngBytes(), 'image/png');
		await runMediaPipeline(approved, deps);
		const { data: anonApproved } = await anon()
			.from('media')
			.select('id, moderation_state')
			.eq('id', approved.mediaId)
			.single();
		expect(anonApproved?.id).toBe(approved.mediaId);
		expect(anonApproved?.moderation_state).toBe('approved');
	});
});
