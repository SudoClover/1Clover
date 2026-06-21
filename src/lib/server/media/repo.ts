/**
 * Service-role media writes (CLAUDE.md §4.4/§4.9). All inserts and state flips on
 * `media` go through the SECRET key, which bypasses RLS — clients have no write
 * privilege on the table at all. `owner_id` is always supplied by the caller from
 * a VERIFIED claim, never from client input, so it cannot be forged.
 *
 * The client is passed in (URL + secret as arguments) rather than read from any
 * framework env, so the consumer Worker can reuse this with its own bindings.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import type { ImageFormat } from '../../domain/upload-policy/index';
import type { MediaSink, ReadyFields } from './pipeline';

export type AdminClient = SupabaseClient<Database>;

/** A fresh service-role client. Caller owns its lifecycle (never module-scope). */
export function createAdminClient(url: string, secretKey: string): AdminClient {
	return createClient<Database>(url, secretKey, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
}

const KIND_BY_FORMAT: Record<ImageFormat, 'image'> = {
	jpeg: 'image',
	png: 'image',
	webp: 'image',
	gif: 'image'
};

/** Insert a `pending`/`pending` media row owned by `ownerId`. Returns its id. */
export async function createMediaRow(
	client: AdminClient,
	input: {
		mediaId: string;
		ownerId: string;
		storageKey: string;
		format: ImageFormat;
		mimeType: string;
		byteSize: number;
	}
): Promise<void> {
	const { error } = await client.from('media').insert({
		id: input.mediaId,
		owner_id: input.ownerId,
		storage_key: input.storageKey,
		kind: KIND_BY_FORMAT[input.format],
		mime_type: input.mimeType,
		byte_size: input.byteSize
	});
	if (error) throw error;
}

export function createMediaSink(client: AdminClient): MediaSink {
	return {
		async markReady(mediaId: string, fields: ReadyFields): Promise<void> {
			const { error } = await client
				.from('media')
				.update({
					processing_state: 'ready',
					moderation_state: fields.moderation,
					mime_type: fields.mimeType,
					width: fields.width,
					height: fields.height,
					byte_size: fields.byteSize,
					checksum: fields.checksum,
					variants: fields.variants
				})
				.eq('id', mediaId);
			if (error) throw error;
		},
		async markFailed(mediaId: string, reason: string): Promise<void> {
			// `failed` is the signal; the machine reason is logged server-side rather
			// than written to the client-readable `variants` column.
			console.warn(`[media] ${mediaId} failed validation/processing: ${reason}`);
			const { error } = await client
				.from('media')
				.update({ processing_state: 'failed' })
				.eq('id', mediaId);
			if (error) throw error;
		}
	};
}
