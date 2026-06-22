import { expect, test } from '@playwright/test';
import { createAdminClient } from '../src/lib/server/media/repo';
import { seedApprovedPost } from './seed-post';

// Board → detail render journey + the create route's auth guard. The post is seeded
// via the service role (the repo keeps UI auth out of E2E — see e2e/auth.test.ts);
// the authed create/edit/delete paths are proven by the posts integration tests.
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

const admin = createAdminClient(URL, SECRET);
const title = `Detail post ${Date.now().toString(36)}`;
const description = 'A described seeded post.';
let userId = '';
let postId = '';

test.beforeAll(async () => {
	({ userId, postId } = await seedApprovedPost(admin, { title, description }));
});

test.afterAll(async () => {
	if (userId) await admin.auth.admin.deleteUser(userId); // cascades post + media
});

test('opening a post from the board shows its detail page with the full image', async ({
	page
}) => {
	await page.goto('/');
	const card = page.locator(`a[href="/post/${postId}"]`);
	await expect(card).toBeVisible();
	await card.click();

	await expect(page).toHaveURL(new RegExp(`/post/${postId}$`));
	await expect(page.getByRole('heading', { name: title })).toBeVisible();
	await expect(page.getByText(description)).toBeVisible();

	const img = page.locator('article img').first();
	await expect(img).toBeVisible();
	expect(await img.getAttribute('src')).toMatch(/^\/media\/.*safe\.webp$/);
});

test('creating a post requires signing in', async ({ page }) => {
	await page.goto('/create');
	await expect(page).toHaveURL(/\/login$/);
});

test('the feed API rejects a malformed cursor but serves the first page', async ({ request }) => {
	const malformed = await request.get(
		'/api/feed?cursor_created=2026-01-01),or(moderation_state.eq.held&cursor_id=not-a-uuid'
	);
	expect(malformed.status()).toBe(400);

	const firstPage = await request.get('/api/feed');
	expect(firstPage.status()).toBe(200);
});
