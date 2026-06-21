import { error, fail, redirect } from '@sveltejs/kit';
import { validatePostEdit } from '$lib/domain/posts/post-input';
import { deletePost, getPostById, updatePost } from '$lib/server/db/posts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const post = await getPostById(locals.supabase, params.id);
	if (!post) error(404, 'Post not found.');
	return { post, isOwner: locals.claims?.sub === post.authorId };
};

export const actions: Actions = {
	// Edit/delete are owner-only via RLS (a non-owner write simply affects zero rows);
	// the UI also only renders these controls to the owner.
	edit: async ({ request, params, locals }) => {
		if (!locals.claims) error(401, 'Sign in to edit.');
		const form = await request.formData();
		const { value, errors } = validatePostEdit({
			title: String(form.get('title') ?? ''),
			description: String(form.get('description') ?? '')
		});
		if (errors.length > 0) return fail(400, { errors });
		await updatePost(locals.supabase, params.id, value);
		return { edited: true };
	},
	delete: async ({ params, locals }) => {
		if (!locals.claims) error(401, 'Sign in to delete.');
		await deletePost(locals.supabase, params.id);
		redirect(303, '/');
	}
};
