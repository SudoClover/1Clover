/**
 * Pure normalization + validation for post tags. Mirrors `posts/post-input.ts`: no I/O,
 * no framework imports, unit-tested in isolation and reused by the server actions.
 *
 * A raw "tags" field (comma/whitespace separated) is normalized to canonical tags —
 * lowercase, `[a-z0-9-]`, single internal hyphens, de-duplicated — matching the DB CHECK
 * on `tags.name`. Normalization is generous ("Pixel Art" → "pixel-art"); only the count
 * cap and per-tag length are surfaced as errors.
 */

export const TAG_MAX_LEN = 30;
export const MAX_TAGS_PER_POST = 10;
export const TAG_RE = /^[a-z0-9-]{1,30}$/;

export interface TagsResult {
	value: string[];
	error: string | null;
}

/** Canonicalize one raw token, or '' when nothing usable remains. */
function normalizeTag(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-') // any run of non-alphanumerics → a single hyphen
		.replace(/^-+|-+$/g, ''); // no leading/trailing hyphens
}

/** Split a comma-separated field into canonical, de-duped tags. Within a tag, internal
 *  whitespace becomes a hyphen ("Pixel Art" → "pixel-art"), so multi-word tags are fine. */
export function normalizeTags(raw: string): string[] {
	const tokens = raw.split(',');
	const seen = new Set<string>();
	const out: string[] = [];
	for (const token of tokens) {
		const tag = normalizeTag(token);
		if (tag && !seen.has(tag)) {
			seen.add(tag);
			out.push(tag);
		}
	}
	return out;
}

/** Normalize + enforce the count cap and per-tag length. Returns a capped value so the
 *  caller can still proceed with a valid subset if it chooses; `error` is user-facing. */
export function validateTags(raw: string): TagsResult {
	const value = normalizeTags(raw);
	if (value.some((tag) => tag.length > TAG_MAX_LEN)) {
		return { value, error: `Each tag must be at most ${TAG_MAX_LEN} characters.` };
	}
	if (value.length > MAX_TAGS_PER_POST) {
		return {
			value: value.slice(0, MAX_TAGS_PER_POST),
			error: `A post can have at most ${MAX_TAGS_PER_POST} tags.`
		};
	}
	return { value, error: null };
}
