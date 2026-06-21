// SvelteKit ambient types. See https://svelte.dev/docs/kit/types#app
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

declare global {
	namespace App {
		/** Verified JWT claims from getClaims() — the basis for authorization. */
		interface SessionClaims {
			sub: string;
			email?: string;
			[key: string]: unknown;
		}
		interface Locals {
			supabase: SupabaseClient<Database>;
			safeGetSession: () => Promise<{
				session: Session | null;
				claims: SessionClaims | null;
			}>;
			session: Session | null;
			claims: SessionClaims | null;
		}
		interface PageData {
			signedIn: boolean;
		}
		// interface Error {}
		// interface PageState {}
		/** Cloudflare bindings, present in prod/Worker, absent in local dev/CI. */
		interface Platform {
			env?: import('$lib/server/media/bindings').MediaBindings;
		}
	}
}

export {};
