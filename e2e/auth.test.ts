import { expect, test } from '@playwright/test';

// Thin, anonymous-only journeys (no DB needed): page rendering + the protected
// route guard. The full signup/login flow is covered by integration tests.

test('signup page renders the form', async ({ page }) => {
	await page.goto('/signup');
	await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
	await expect(page.locator('input[name="email"]')).toBeVisible();
	await expect(page.locator('input[name="username"]')).toBeVisible();
});

test('login page renders', async ({ page }) => {
	await page.goto('/login');
	await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('account redirects to login when signed out', async ({ page }) => {
	await page.goto('/account');
	await expect(page).toHaveURL(/\/login$/);
});
