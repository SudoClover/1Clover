import { expect, test } from '@playwright/test';
import { createAdminClient } from '../src/lib/server/media/repo';
import { seedApprovedPost } from './seed-post';

// Anonymous board render: a seeded approved post shows on the public board and its
// cover is served as a non-executable image (re-encoded webp, nosniff). Needs local
// Supabase + env (CI exports them). The authed create journey is covered by the posts
// integration tests (ADR-0012 + Slice 3).
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

const admin = createAdminClient(URL, SECRET);
const title = `Board post ${Date.now().toString(36)}`;
let userId = '';

test.beforeAll(async () => {
	({ userId } = await seedApprovedPost(admin, { title }));
});

test.afterAll(async () => {
	if (userId) await admin.auth.admin.deleteUser(userId); // cascades post + media
});

test('an approved post appears on the board and its cover serves as a non-executable image', async ({
	page
}) => {
	await page.goto('/');
	const cover = page.getByRole('img', { name: title }).first();
	await expect(cover).toBeVisible();

	const src = await cover.getAttribute('src');
	expect(src).toMatch(/^\/media\/.*thumb\.webp$/);

	const res = await page.request.get(src!);
	expect(res.status()).toBe(200);
	expect(res.headers()['content-type']).toBe('image/webp');
	expect(res.headers()['x-content-type-options']).toBe('nosniff');
});
