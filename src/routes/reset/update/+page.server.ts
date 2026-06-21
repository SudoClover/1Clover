import { fail, redirect } from '@sveltejs/kit';
import { validatePassword } from '$lib/domain/auth/credentials';
import type { Actions } from './$types';

// Reached via the password-recovery email link, which establishes a session.
export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');

		const err = validatePassword(password);
		if (err) return fail(400, { message: err.message });

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) return fail(400, { message: error.message });

		redirect(303, '/account');
	}
};
