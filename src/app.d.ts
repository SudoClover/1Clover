// SvelteKit ambient types. See https://svelte.dev/docs/kit/types#app
// Later slices populate Locals (Supabase client + verified claims) and Platform
// (Cloudflare bindings: R2, Queues, env). Kept empty in the foundation slice.
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
