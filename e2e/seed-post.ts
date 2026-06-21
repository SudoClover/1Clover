import sharp from 'sharp';
import { createMediaRow, createMediaSink, type AdminClient } from '../src/lib/server/media/repo';
import { createFsStore } from '../src/lib/server/media/store-fs';
import { runMediaPipeline } from '../src/lib/server/media/pipeline';
import { stubClassifier } from '../src/lib/server/media/classify';
import { sharpProcessor } from '../src/lib/server/media/processor-sharp';
import { originalKey } from '../src/lib/server/media/keys';

// Seeds an approved post (a user + one pipeline-approved image + the post linking it)
// directly via the service role. E2E here covers the ANONYMOUS render journeys (the
// repo deliberately keeps UI auth out of E2E — see e2e/auth.test.ts); the authed
// create/edit/delete paths are proven by the posts integration tests against RLS.
const STORE_DIR = process.env.MEDIA_STORE_DIR || '.r2-dev';

export interface SeededPost {
	userId: string;
	postId: string;
}

export async function seedApprovedPost(
	admin: AdminClient,
	opts: { title: string; description?: string | null }
): Promise<SeededPost> {
	const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
	const { data: userRes, error: userErr } = await admin.auth.admin.createUser({
		email: `seed_${suffix}@example.test`,
		password: 'password123',
		email_confirm: true,
		user_metadata: { username: `seed_${suffix}`.slice(0, 30) }
	});
	if (userErr) throw userErr;
	const userId = userRes.user.id;

	// One approved image through the REAL pipeline, into the store the dev server reads.
	const png = new Uint8Array(
		await sharp({
			create: { width: 20, height: 16, channels: 3, background: { r: 80, g: 160, b: 120 } }
		})
			.png()
			.toBuffer()
	);
	const store = createFsStore(STORE_DIR);
	const mediaId = crypto.randomUUID();
	const storageKey = originalKey(userId, mediaId);
	await store.put(storageKey, png);
	await createMediaRow(admin, {
		mediaId,
		ownerId: userId,
		storageKey,
		format: 'png',
		mimeType: 'image/png',
		byteSize: png.length
	});
	const outcome = await runMediaPipeline(
		{ mediaId, ownerId: userId, storageKey, declaredMime: 'image/png' },
		{ store, processor: sharpProcessor, classify: stubClassifier, sink: createMediaSink(admin) }
	);
	if (outcome.state !== 'approved')
		throw new Error(`seed not approved: ${JSON.stringify(outcome)}`);

	// The post + its media link (service role bypasses RLS for the seed).
	const { data: post, error: postErr } = await admin
		.from('posts')
		.insert({ author_id: userId, title: opts.title, description: opts.description ?? null })
		.select('id')
		.single();
	if (postErr) throw postErr;
	const { error: linkErr } = await admin
		.from('post_media')
		.insert({ post_id: post.id, media_id: mediaId, position: 0 });
	if (linkErr) throw linkErr;

	return { userId, postId: post.id };
}
