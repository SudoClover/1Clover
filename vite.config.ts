import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Unit tests for pure domain logic run in plain Node (no browser, no DB).
		// Integration tests against local Supabase are added in later slices.
		include: ['src/**/*.{test,spec}.ts'],
		environment: 'node'
	}
});
