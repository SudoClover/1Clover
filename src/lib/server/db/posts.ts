/**
 * Server-side data access for posts (ARCHITECTURE.md §4.2). Unlike `media` (all
 * service-role writes), posts are CLIENT-WRITABLE: every call here uses the
 * PER-REQUEST authed client (`locals.supabase`) and RLS enforces ownership +
 * approved-only public reads. Creation goes through the `create_post` RPC so a post
 * and its media links commit atomically (see schema comment).
 *
 * Only re-encoded variant URLs are exposed to callers — never the original key.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../types/database';
import type {
	BoardCard,
	BoardCursor,
	BoardPage,
	LibraryItem,
	PostView
} from '../../domain/posts/types';
import { variantUrl } from '../../media-url';

export type DbClient = SupabaseClient<Database>;

export const BOARD_PAGE_SIZE = 24;

interface MediaVariants {
	safe?: string;
	thumb?: string;
}

// Embedded media for a post, in position order; filtered to approved+ready at render.
// Exported so the tags layer (similar posts) builds cover thumbnails the same way.
export const MEDIA_EMBED =
	'post_media(position, media:media_id(id, width, height, variants, moderation_state, processing_state))';

/** Newest-first page of approved posts, each with a cover thumbnail. Keyset cursor on
 *  (created_at, id) using the partial board index — no offset enumeration. */
export async function getBoardPage(
	client: DbClient,
	cursor?: BoardCursor | null,
	limit: number = BOARD_PAGE_SIZE
): Promise<BoardPage> {
	let query = client
		.from('posts')
		.select(`id, title, author_id, created_at, ${MEDIA_EMBED}`)
		.eq('moderation_state', 'approved')
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(limit + 1);

	if (cursor) {
		query = query.or(
			`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
		);
	}

	const { data, error } = await query;
	if (error) throw error;

	const rows = data ?? [];
	const hasMore = rows.length > limit;
	const page = rows.slice(0, limit);
	const last = page.at(-1);
	const nextCursor = hasMore && last ? { createdAt: last.created_at, id: last.id } : null;

	const cards = page
		.map((row): BoardCard | null => {
			const cover = readyMedia(row.post_media)[0];
			return cover ? { id: row.id, title: row.title, ...coverFields(cover) } : null;
		})
		.filter((c): c is BoardCard => c !== null);

	return { cards, nextCursor };
}

/** A single post by id, or null when it isn't visible to the caller (RLS). */
export async function getPostById(client: DbClient, postId: string): Promise<PostView | null> {
	const { data, error } = await client
		.from('posts')
		.select(`id, title, description, author_id, created_at, edited_at, ${MEDIA_EMBED}`)
		.eq('id', postId)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;

	return {
		id: data.id,
		title: data.title,
		description: data.description,
		authorId: data.author_id,
		createdAt: data.created_at,
		editedAt: data.edited_at,
		media: readyMedia(data.post_media).map((m) => ({
			id: m.id,
			src: variantUrl(m.variants.safe ?? m.variants.thumb ?? ''),
			width: m.width,
			height: m.height
		}))
	};
}

/** Create a post + link the given media atomically; returns the new post id. */
export async function createPost(
	client: DbClient,
	input: { title: string; description: string | null; mediaIds: string[] }
): Promise<string> {
	const { data, error } = await client.rpc('create_post', {
		p_title: input.title,
		p_description: input.description ?? '',
		p_media_ids: input.mediaIds
	});
	if (error) throw error;
	return data;
}

/** Edit own post's title/description; the DB trigger stamps edited_at. RLS limits this
 *  to the author, so a non-owner affects zero rows — returns false (caller maps to 403). */
export async function updatePost(
	client: DbClient,
	postId: string,
	fields: { title: string; description: string | null }
): Promise<boolean> {
	const { data, error } = await client
		.from('posts')
		.update({ title: fields.title, description: fields.description })
		.eq('id', postId)
		.select('id');
	if (error) throw error;
	return (data?.length ?? 0) > 0;
}

/** Delete own post (cascades post_media). RLS limits this to the author, so a non-owner
 *  affects zero rows — returns false. */
export async function deletePost(client: DbClient, postId: string): Promise<boolean> {
	const { data, error } = await client.from('posts').delete().eq('id', postId).select('id');
	if (error) throw error;
	return (data?.length ?? 0) > 0;
}

/** The caller's own approved+ready media — the pool they can attach to a new post. */
export async function listPostableMedia(client: DbClient, ownerId: string): Promise<LibraryItem[]> {
	const { data, error } = await client
		.from('media')
		.select('id, width, height, variants')
		.eq('owner_id', ownerId)
		.eq('moderation_state', 'approved')
		.eq('processing_state', 'ready')
		.order('created_at', { ascending: false })
		.limit(60);
	if (error) throw error;

	return (data ?? [])
		.map((m): LibraryItem | null => {
			const variants = asVariants(m.variants);
			return variants.thumb
				? { id: m.id, thumb: variantUrl(variants.thumb), width: m.width, height: m.height }
				: null;
		})
		.filter((x): x is LibraryItem => x !== null);
}

export interface ReadyMedia {
	id: string;
	width: number | null;
	height: number | null;
	variants: MediaVariants;
}

/** Approved+ready embedded media, in position order, with parsed variant keys. */
export function readyMedia(links: { position: number; media: MediaRow | null }[]): ReadyMedia[] {
	return [...links]
		.sort((a, b) => a.position - b.position)
		.map((link) => link.media)
		.filter((m): m is MediaRow => m !== null)
		.filter((m) => m.moderation_state === 'approved' && m.processing_state === 'ready')
		.map((m) => ({ id: m.id, width: m.width, height: m.height, variants: asVariants(m.variants) }))
		.filter((m) => Boolean(m.variants.thumb || m.variants.safe));
}

interface MediaRow {
	id: string;
	width: number | null;
	height: number | null;
	variants: Json;
	moderation_state: Database['public']['Enums']['moderation_state'];
	processing_state: Database['public']['Enums']['processing_state'];
}

export function coverFields(m: ReadyMedia): {
	cover: string;
	width: number | null;
	height: number | null;
} {
	return {
		cover: variantUrl(m.variants.thumb ?? m.variants.safe ?? ''),
		width: m.width,
		height: m.height
	};
}

function asVariants(value: Json): MediaVariants {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const v = value as Record<string, unknown>;
		return {
			safe: typeof v.safe === 'string' ? v.safe : undefined,
			thumb: typeof v.thumb === 'string' ? v.thumb : undefined
		};
	}
	return {};
}
