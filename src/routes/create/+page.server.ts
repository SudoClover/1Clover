import { fail, redirect } from '@sveltejs/kit';
import { validatePostInput } from '$lib/domain/posts/post-input';
import { createPost, listPostableMedia } from '$lib/server/db/posts';
import type { Actions, PageServerLoad } from './$types';

// The authGuard hook guarantees a verified session here, so claims is non-null.
export const load: PageServerLoad = async ({ locals }) => {
	const library = await listPostableMedia(locals.supabase, locals.claims!.sub);
	return { library };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '');
		const description = String(form.get('description') ?? '');
		const mediaIds = form.getAll('media').map((v) => String(v));

		const { value, errors } = validatePostInput({ title, description, mediaIds });
		if (errors.length > 0) return fail(400, { errors, title, description });

		let postId: string;
		try {
			postId = await createPost(locals.supabase, value);
		} catch (e) {
			// Most likely RLS rejecting media the user doesn't own — a 400, not a 500.
			console.warn('[create] createPost failed:', (e as Error).message);
			return fail(400, {
				errors: [
					{ field: 'media', message: 'Could not create the post. Use only your own images.' }
				],
				title,
				description
			});
		}

		redirect(303, `/post/${postId}`);
	}
};
