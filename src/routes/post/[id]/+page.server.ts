import { error, fail, redirect } from '@sveltejs/kit';
import { validatePostEdit } from '$lib/domain/posts/post-input';
import { validateTags } from '$lib/domain/tags/tag-input';
import { deletePost, getPostById, updatePost } from '$lib/server/db/posts';
import { getPostTags, getSimilarPosts, setPostTags } from '$lib/server/db/tags';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const post = await getPostById(locals.supabase, params.id);
	if (!post) error(404, 'Post not found.');
	const [tags, similar] = await Promise.all([
		getPostTags(locals.supabase, params.id),
		getSimilarPosts(locals.supabase, params.id)
	]);
	return { post, tags, similar, isOwner: locals.claims?.sub === post.authorId };
};

export const actions: Actions = {
	// Edit/delete are owner-only via RLS (a non-owner write affects zero rows → 403);
	// the UI also only renders these controls to the owner.
	edit: async ({ request, params, locals }) => {
		if (!locals.claims) error(401, 'Sign in to edit.');
		const form = await request.formData();
		const { value, errors } = validatePostEdit({
			title: String(form.get('title') ?? ''),
			description: String(form.get('description') ?? '')
		});
		const tags = validateTags(String(form.get('tags') ?? ''));
		if (errors.length > 0 || tags.error) return fail(400, { errors, tagError: tags.error });
		if (!(await updatePost(locals.supabase, params.id, value)))
			error(403, 'You can only edit your own post.');
		// Ownership is confirmed by the update above; replace the post's tags to match.
		// Best-effort (like create): a tag hiccup must not 500 an edit whose text already saved.
		try {
			await setPostTags(locals.supabase, params.id, tags.value);
		} catch (e) {
			console.warn('[edit] setPostTags failed:', (e as Error).message);
		}
		return { edited: true };
	},
	delete: async ({ params, locals }) => {
		if (!locals.claims) error(401, 'Sign in to delete.');
		if (!(await deletePost(locals.supabase, params.id)))
			error(403, 'You can only delete your own post.');
		redirect(303, '/');
	}
};
