/**
 * Upload endpoint (ARCHITECTURE §5, ADR-0007/0012). Auth-gated; accepts ONE image
 * as multipart form-data, runs the cheap declared pre-check, generates a server-side
 * storage key, writes the original to the object store, inserts a `pending` media
 * row (service-role — clients have no write privilege), and dispatches processing.
 * The heavy validate/re-encode/classify happens off this path (queue/consumer).
 */
import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { MAX_IMAGE_BYTES, validateDeclaredUpload } from '$lib/domain/upload-policy';
import { originalKey } from '$lib/server/media/keys';
import { resolveStore } from '$lib/server/media/store';
import { createAdminClient, createMediaRow } from '$lib/server/media/repo';
import { dispatchMedia } from '$lib/server/media/dispatch';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const { claims } = await locals.safeGetSession();
	if (!claims) error(401, 'Sign in to upload.');
	const ownerId = claims.sub;

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) error(400, 'Expected a single file field named "file".');

	const declared = validateDeclaredUpload({ mimeType: file.type, byteSize: file.size });
	if (!declared.ok) error(415, `Upload rejected: ${declared.reason}`);

	const bytes = new Uint8Array(await file.arrayBuffer());
	// Re-check the real byte length — file.size is client-supplied and untrusted.
	if (bytes.length === 0) error(400, 'Empty file.');
	if (bytes.length > MAX_IMAGE_BYTES) error(413, 'Upload rejected: too_large');

	const supabaseUrl = env.PUBLIC_SUPABASE_URL;
	const secretKey = privateEnv.SUPABASE_SECRET_KEY;
	if (!supabaseUrl || !secretKey) error(500, 'Media storage is not configured.');

	const mediaId = crypto.randomUUID();
	const storageKey = originalKey(ownerId, mediaId);

	const store = await resolveStore(platform?.env?.MEDIA_BUCKET);
	await store.put(storageKey, bytes);

	const admin = createAdminClient(supabaseUrl, secretKey);
	await createMediaRow(admin, {
		mediaId,
		ownerId,
		storageKey,
		format: declared.format,
		mimeType: declared.mimeType,
		byteSize: bytes.length
	});

	await dispatchMedia({ mediaId, ownerId, storageKey, declaredMime: file.type }, platform?.env);

	return json({ mediaId, processingState: 'pending' }, { status: 202 });
};
