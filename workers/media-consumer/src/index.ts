/**
 * Media consumer Worker (ARCHITECTURE §5, ADR-0007/0012). Cloudflare Queues delivers
 * a batch of media jobs; each runs through the one shared pipeline (validate →
 * re-encode → thumbnail → classify → flip state). A processed message is acked; a
 * thrown error is retried (Queues dead-letters after its max retries).
 *
 * The image transform here is Cloudflare Images (deferred to deploy); the pipeline
 * itself is exercised in CI by the Node integration test (sharp) and the workers
 * test (real R2 binding + stub processor).
 */
import { runMediaPipeline, type MediaJob } from '../../../src/lib/server/media/pipeline';
import { buildDeps } from './deps';
import type { ConsumerEnv } from './env';

interface QueueMessage {
	body: MediaJob;
	ack(): void;
	retry(): void;
}
interface MessageBatch {
	messages: QueueMessage[];
}

export default {
	async queue(batch: MessageBatch, env: ConsumerEnv): Promise<void> {
		const deps = buildDeps(env);
		for (const message of batch.messages) {
			try {
				await runMediaPipeline(message.body, deps);
				message.ack();
			} catch (err) {
				console.error('[media-consumer] job failed, retrying', message.body?.mediaId, err);
				message.retry();
			}
		}
	}
};
