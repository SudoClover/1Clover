import type { LayoutServerLoad } from './$types';

// Expose the (verified) session to every page so the nav can reflect auth state.
export const load: LayoutServerLoad = async ({ locals }) => {
	return { session: locals.session };
};
