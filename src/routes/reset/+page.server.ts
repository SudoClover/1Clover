import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');

		await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/reset/update`
		});
		// Always report success — never reveal whether an account exists.
		return { success: true };
	}
};
