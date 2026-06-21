/**
 * Dispatch a created `media` row into processing (ADR-0012). In prod a Cloudflare
 * Queue binding is present → enqueue, and the consumer Worker processes async
 * (heavy work off the request path — security invariant). In local dev/CI there is
 * no Queue binding → the row stays `pending`; the Node pipeline that processes it is
 * proven by the media integration test, and the consumer Worker by the workers test.
 *
 * Deliberately free of any Node/sharp import so it is safe in the workerd bundle.
 */
import type { MediaJob } from './pipeline';
import type { MediaBindings } from './bindings';

export async function dispatchMedia(job: MediaJob, env: MediaBindings | undefined): Promise<void> {
	if (env?.MEDIA_QUEUE) {
		await env.MEDIA_QUEUE.send(job);
		return;
	}
	console.info(`[media] ${job.mediaId} created pending — no Queue binding in this environment.`);
}
