import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// The authGuard hook guarantees a verified session here, so claims is non-null.
export const load: PageServerLoad = async ({ locals }) => {
	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('id, username, display_name, bio, created_at')
		.eq('id', locals.claims!.sub)
		.single();
	return { profile };
};

export const actions: Actions = {
	updateProfile: async ({ request, locals }) => {
		const form = await request.formData();
		const displayName = String(form.get('display_name') ?? '').trim() || null;
		const bio = String(form.get('bio') ?? '').trim() || null;

		const { error } = await locals.supabase
			.from('profiles')
			.update({ display_name: displayName, bio })
			.eq('id', locals.claims!.sub);
		if (error) return fail(400, { message: error.message });

		return { success: true };
	}
};
