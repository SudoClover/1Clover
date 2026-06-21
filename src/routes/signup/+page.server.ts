import { fail } from '@sveltejs/kit';
import { validateSignup } from '$lib/domain/auth/credentials';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const username = String(form.get('username') ?? '').toLowerCase();
		const birthdate = String(form.get('birthdate') ?? '');

		const errors = validateSignup({ email, password, username });
		if (errors.length > 0) return fail(400, { email, username, errors });

		const { error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: { username, birthdate: birthdate || null },
				emailRedirectTo: `${url.origin}/account`
			}
		});
		if (error) {
			return fail(400, {
				email,
				username,
				errors: [{ field: 'email' as const, message: error.message }]
			});
		}
		return { email, success: true };
	}
};
