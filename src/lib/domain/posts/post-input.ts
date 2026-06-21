/**
 * Pure validation + normalization for post create/edit input (title, description,
 * media selection). Mirrors the DB CHECK constraints on public.posts (title 1..140,
 * description ≤ 2000) and the "1..n media" rule. No I/O, no framework imports — it is
 * unit-tested in isolation (ARCHITECTURE.md §2) and reused by the server actions.
 */

export const TITLE_MAX = 140;
export const DESCRIPTION_MAX = 2000;
export const MAX_MEDIA_PER_POST = 20;

export interface PostFieldError {
	field: 'title' | 'description' | 'media';
	message: string;
}

export interface PostFields {
	title: string;
	description: string | null;
}

export interface PostInput extends PostFields {
	mediaIds: string[];
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trim title/description; collapse an empty/whitespace description to null. */
function normalizeFields(raw: { title: string; description?: string | null }): PostFields {
	const title = raw.title.trim();
	const description = (raw.description ?? '').trim();
	return { title, description: description.length > 0 ? description : null };
}

function fieldErrors(fields: PostFields): PostFieldError[] {
	const errors: PostFieldError[] = [];
	if (fields.title.length < 1) {
		errors.push({ field: 'title', message: 'A title is required.' });
	} else if (fields.title.length > TITLE_MAX) {
		errors.push({ field: 'title', message: `Title must be at most ${TITLE_MAX} characters.` });
	}
	if ((fields.description?.length ?? 0) > DESCRIPTION_MAX) {
		errors.push({
			field: 'description',
			message: `Description must be at most ${DESCRIPTION_MAX} characters.`
		});
	}
	return errors;
}

/** De-duplicate media ids, preserving first-seen order. */
function dedupe(ids: string[]): string[] {
	const seen = new Set<string>();
	return ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
}

/** Validate the title/description of an EDIT (media is unchanged on edit). */
export function validatePostEdit(raw: { title: string; description?: string | null }): {
	value: PostFields;
	errors: PostFieldError[];
} {
	const value = normalizeFields(raw);
	return { value, errors: fieldErrors(value) };
}

/** Validate a full CREATE: title/description + a 1..n selection of media ids. */
export function validatePostInput(raw: {
	title: string;
	description?: string | null;
	mediaIds: string[];
}): { value: PostInput; errors: PostFieldError[] } {
	const fields = normalizeFields(raw);
	const mediaIds = dedupe(raw.mediaIds);
	const errors = fieldErrors(fields);

	if (mediaIds.length < 1) {
		errors.push({ field: 'media', message: 'Add at least one image to your post.' });
	} else if (mediaIds.length > MAX_MEDIA_PER_POST) {
		errors.push({
			field: 'media',
			message: `A post can have at most ${MAX_MEDIA_PER_POST} images.`
		});
	} else if (!mediaIds.every((id) => UUID_RE.test(id))) {
		errors.push({ field: 'media', message: 'One or more selected images are invalid.' });
	}

	return { value: { ...fields, mediaIds }, errors };
}
