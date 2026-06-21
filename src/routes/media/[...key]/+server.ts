/**
 * Serve a processed media variant (ARCHITECTURE §5/§9). ONLY the re-encoded safe
 * copy and thumbnail are servable — never the original upload — and always as a
 * non-executable image (`nosniff`, `inline`). At deploy this is replaced by signed
 * R2/CDN URLs; for now it streams the variant from the object store.
 *
 * NOTE (Slice 8 / deploy): this route serves any EXISTING variant by key and does
 * NOT consult `moderation_state`. In Slice 2 that's safe because the classifier stub
 * only ever produces `approved` — no `held` content exists. Once the real classifier
 * can mark content `held`, the signed-URL replacement MUST gate issuance on
 * `moderation_state = 'approved'` (keys are unguessable but that is not access control).
 */
import { error } from '@sveltejs/kit';
import { resolveStore } from '$lib/server/media/store';
import type { RequestHandler } from './$types';

const SERVABLE = /\/(safe|thumb)\.webp$/;

export const GET: RequestHandler = async ({ params, platform }) => {
	const key = params.key;
	if (!SERVABLE.test(key)) error(404, 'Not found');

	const store = await resolveStore(platform?.env?.MEDIA_BUCKET);
	const bytes = await store.get(key);
	if (!bytes) error(404, 'Not found');

	return new Response(new Uint8Array(bytes), {
		headers: {
			'content-type': 'image/webp',
			'x-content-type-options': 'nosniff',
			'content-disposition': 'inline',
			'cache-control': 'public, max-age=300'
		}
	});
};
