import type { LayoutServerLoad } from './$types';

// Expose only a boolean to the client so the nav can reflect auth state — never
// the session object/tokens (reviewer L1: expose strictly less).
export const load: LayoutServerLoad = async ({ locals }) => {
	return { signedIn: Boolean(locals.claims) };
};
