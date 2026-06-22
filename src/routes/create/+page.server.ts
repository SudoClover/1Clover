import { fail, redirect } from '@sveltejs/kit';
import { validatePostInput } from '$lib/domain/posts/post-input';
import { validateTags } from '$lib/domain/tags/tag-input';
import { createPost, listPostableMedia } from '$lib/server/db/posts';
import { setPostTags } from '$lib/server/db/tags';
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
		const tagsRaw = String(form.get('tags') ?? '');
		const mediaIds = form.getAll('media').map((v) => String(v));

		const { value, errors } = validatePostInput({ title, description, mediaIds });
		const tags = validateTags(tagsRaw);
		if (errors.length > 0 || tags.error) {
			return fail(400, { errors, tagError: tags.error, title, description, tags: tagsRaw });
		}

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
				tagError: null,
				title,
				description,
				tags: tagsRaw
			});
		}

		// Tags are secondary to the post: link them best-effort so a tag hiccup never 500s a
		// successful create (the owner can re-edit tags on the detail page).
		if (tags.value.length > 0) {
			try {
				await setPostTags(locals.supabase, postId, tags.value);
			} catch (e) {
				console.warn('[create] setPostTags failed:', (e as Error).message);
			}
		}

		redirect(303, `/post/${postId}`);
	}
};
