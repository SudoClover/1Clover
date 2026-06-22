import { expect, test } from '@playwright/test';
import { createAdminClient } from '../src/lib/server/media/repo';
import { seedApprovedPost } from './seed-post';

// Feed switcher journey (Slice 5), anonymous. Switching feeds is plain-link navigation
// (server-rendered), so there's no hydration race — unlike UI auth, which the repo keeps
// out of E2E (see e2e/auth.test.ts). The per-feed ordering/filtering is proven by the
// feeds integration tests against RLS.
const URL = process.env.PUBLIC_SUPABASE_URL as string;
const SECRET = process.env.SUPABASE_SECRET_KEY as string;

const admin = createAdminClient(URL, SECRET);
const title = `Feed post ${Date.now().toString(36)}`;
let userId = '';

test.beforeAll(async () => {
	({ userId } = await seedApprovedPost(admin, { title }));
});

test.afterAll(async () => {
	if (userId) await admin.auth.admin.deleteUser(userId); // cascades post + media
});

test('the board offers feed tabs and switching modes keeps an approved post visible', async ({
	page
}) => {
	await page.goto('/');

	// New / Hot / Top are public; Following is hidden until signed in.
	await expect(page.getByRole('link', { name: 'New', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Hot', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Top', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Following', exact: true })).toHaveCount(0);
	await expect(page.getByRole('img', { name: title }).first()).toBeVisible();

	// Hot: no ratings yet, so the post still shows.
	await page.getByRole('link', { name: 'Hot', exact: true }).click();
	await expect(page).toHaveURL(/\?mode=hot$/);
	await expect(page.getByRole('img', { name: title }).first()).toBeVisible();

	// Top: a day/week/all sub-selector appears and the recent post is in the window.
	await page.getByRole('link', { name: 'Top', exact: true }).click();
	await expect(page).toHaveURL(/mode=top&window=day$/);
	await expect(page.getByRole('link', { name: 'This week', exact: true })).toBeVisible();
	await expect(page.getByRole('img', { name: title }).first()).toBeVisible();
});
