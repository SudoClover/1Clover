import { defineConfig } from '@playwright/test';

// E2E suite is kept separate from unit/integration (Vitest). Critical-journey
// tests grow from Slice 1; this slice has a single smoke test.
export default defineConfig({
	testDir: 'e2e',
	// Serialize: adapter-cloudflare's dev emulation (miniflare) can hit a transient
	// SQLITE_BUSY race when several workers initialize it at once. Retries cover any
	// remaining one-off startup flake.
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 1,
	webServer: {
		// adapter-cloudflare has no `vite preview`; run E2E against the dev server.
		// Production-build E2E (via `wrangler dev`) is wired when deploy lands.
		command: 'pnpm dev --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:4173'
	}
});
