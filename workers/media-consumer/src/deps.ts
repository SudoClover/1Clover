/**
 * Build the pipeline dependencies from the consumer Worker's bindings (ADR-0012):
 * R2 object store, Cloudflare Images processor (deferred), the stub classifier, and
 * the service-role DB sink. Imports the app's server library by relative path —
 * the worker bundle has no `$lib` alias.
 */
import { createR2Store } from '../../../src/lib/server/media/store-r2';
import { createAdminClient, createMediaSink } from '../../../src/lib/server/media/repo';
import { stubClassifier } from '../../../src/lib/server/media/classify';
import type { PipelineDeps } from '../../../src/lib/server/media/pipeline';
import { createImagesProcessor } from './processor-images';
import type { ConsumerEnv } from './env';

export function buildDeps(env: ConsumerEnv): PipelineDeps {
	const admin = createAdminClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
	return {
		store: createR2Store(env.MEDIA_BUCKET),
		processor: createImagesProcessor(env.IMAGES),
		classify: stubClassifier,
		sink: createMediaSink(admin)
	};
}
