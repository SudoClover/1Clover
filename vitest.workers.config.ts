import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

// Runs the consumer Worker's tests INSIDE workerd with real Cloudflare bindings
// (R2 + Queues simulated by miniflare) — CLAUDE.md §6. Kept separate from the unit
// + integration configs because it needs the Workers runtime, not Node.
// (vitest-pool-workers v0.16 / Vitest 4 wires the pool via a Vite plugin.)
export default defineConfig({
	plugins: [cloudflareTest({ wrangler: { configPath: './workers/media-consumer/wrangler.toml' } })],
	test: {
		include: ['workers/**/*.test.ts']
	}
});
