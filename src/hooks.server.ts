import { createServerClient } from '@supabase/ssr';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/public';

// A fresh, per-request Supabase client (never module-scope — CLAUDE.md §4).
const supabase: Handle = async ({ event, resolve }) => {
	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) {
		throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY');
	}

	event.locals.supabase = createServerClient(url, key, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});

	// Authorize on VERIFIED claims (getClaims), never the spoofable getSession.
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, claims: null };

		const { data, error } = await event.locals.supabase.auth.getClaims();
		if (error || !data?.claims) return { session: null, claims: null };
		return { session, claims: data.claims as App.SessionClaims };
	};

	return resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

// Route guard: members area requires a verified session; auth pages bounce to
// the account page when already signed in.
const authGuard: Handle = async ({ event, resolve }) => {
	const { session, claims } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.claims = claims;

	const path = event.url.pathname;
	if (
		!claims &&
		(path.startsWith('/account') || path.startsWith('/upload') || path.startsWith('/create'))
	)
		redirect(303, '/login');
	if (claims && (path === '/login' || path === '/signup')) redirect(303, '/account');

	return resolve(event);
};

export const handle = sequence(supabase, authGuard);
