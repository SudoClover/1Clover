import { defineConfig } from 'vitest/config';

// Integration tests run against LOCAL Supabase (real schema, auth, RLS). Kept in
// a separate config from unit tests because they need env + a running database.
export default defineConfig({
	test: {
		include: ['tests/integration/**/*.test.ts'],
		environment: 'node',
		setupFiles: ['dotenv/config'],
		testTimeout: 20000,
		hookTimeout: 20000,
		// Files share one local DB with no per-test isolation, so run them serially: parallel
		// files creating posts concurrently would break recency-ordering assertions (feeds/board).
		fileParallelism: false
	}
});
