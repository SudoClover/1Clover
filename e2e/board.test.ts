import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { createFsStore } from '../src/lib/server/media/store-fs';
import { createAdminClient, createMediaRow, createMediaSink } from '../src/lib/server/media/repo';
import { runMediaPipeline } from '../src/lib/server/media/pipeline';
import { stubClassifier } from '../src/lib/server/media/classify';
import { sharpProcessor } from '../src/lib/server/media/processor-sharp';
import { originalKey } from '../src/lib/server/media/keys';

// Board-render journey: a real approved image shows up on the public board and its
// served variant is non-executable. Seeded through the REAL pipeline (sharp), into
// the SAME object store the dev server reads (DEV_STORE_DIR default `.r2-dev`).
// Needs local Supabase + env (CI exports them). The authed upload→approve journey is
// covered by the media integration + workers tests (ADR-0012).
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;
const STORE_DIR = process.env.MEDIA_STORE_DIR || '.r2-dev';

const admin = createAdminClient(URL, SECRET);
let ownerId = '';

test.beforeAll(async () => {
	const suffix = Date.now().toString(36);
	const { data, error } = await admin.auth.admin.createUser({
		email: `board_${suffix}@example.test`,
		password: 'password123',
		email_confirm: true,
		user_metadata: { username: `board_${suffix}` }
	});
	if (error) throw error;
	ownerId = data.user.id;

	const png = new Uint8Array(
		await sharp({
			create: { width: 16, height: 12, channels: 3, background: { r: 20, g: 160, b: 90 } }
		})
			.png()
			.toBuffer()
	);
	const store = createFsStore(STORE_DIR);
	const mediaId = crypto.randomUUID();
	const storageKey = originalKey(ownerId, mediaId);
	await store.put(storageKey, png);
	await createMediaRow(admin, {
		mediaId,
		ownerId,
		storageKey,
		format: 'png',
		mimeType: 'image/png',
		byteSize: png.length
	});
	const outcome = await runMediaPipeline(
		{ mediaId, ownerId, storageKey, declaredMime: 'image/png' },
		{ store, processor: sharpProcessor, classify: stubClassifier, sink: createMediaSink(admin) }
	);
	if (outcome.state !== 'approved')
		throw new Error(`seed not approved: ${JSON.stringify(outcome)}`);
});

test.afterAll(async () => {
	if (ownerId) await admin.auth.admin.deleteUser(ownerId); // cascades the media row
});

test('an approved image appears on the board and serves as a non-executable image', async ({
	page
}) => {
	await page.goto('/');
	const card = page.getByRole('img', { name: 'Community upload' }).first();
	await expect(card).toBeVisible();

	const src = await card.getAttribute('src');
	expect(src).toMatch(/^\/media\/.*thumb\.webp$/);

	const res = await page.request.get(src!);
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toBe('image/webp');
	expect(res.headers()['x-content-type-options']).toBe('nosniff');
});
