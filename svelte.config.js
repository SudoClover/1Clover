import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Deploys to Cloudflare Workers (see ADR-0001). Defaults are fine for now;
		// the wrangler config is finalized when deploy is wired (overseer-owned).
		adapter: adapter()
	}
};

export default config;
