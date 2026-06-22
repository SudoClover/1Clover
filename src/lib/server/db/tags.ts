/**
 * Server-side data access for tags + "similar posts" (ARCHITECTURE.md §4.2 — Slice 4).
 * Like `posts`, tags are CLIENT-WRITABLE: every call uses the PER-REQUEST authed client
 * (`locals.supabase`) and RLS enforces ownership + approved-only public reads. Tag writes
 * go through the `set_post_tags` RPC so the get-or-create + relink is one transaction.
 *
 * Kept separate from `posts.ts` to stay under the file-size limit; reuses its cover-media
 * helpers so similar-post thumbnails are built exactly like the board's.
 */
import type { BoardCard } from '../../domain/posts/types';
import { findSimilar, type SimilarCandidate } from '../../domain/recommend/find-similar';
import { MEDIA_EMBED, coverFields, readyMedia, type DbClient, type ReadyMedia } from './posts';

const SIMILAR_CANDIDATE_CAP = 200;
export const SIMILAR_LIMIT = 12;

/** A post's tag names, sorted for a stable render order. */
export async function getPostTags(client: DbClient, postId: string): Promise<string[]> {
	const { data, error } = await client.from('post_tags').select('tags(name)').eq('post_id', postId);
	if (error) throw error;
	return (data ?? [])
		.map((row) => row.tags?.name)
		.filter((name): name is string => Boolean(name))
		.sort();
}

/** Replace a post's tags with `names` (already normalized by the domain layer). The RPC is
 *  SECURITY INVOKER + owner-checked, so a non-owner call raises and changes nothing. */
export async function setPostTags(
	client: DbClient,
	postId: string,
	names: string[]
): Promise<void> {
	const { error } = await client.rpc('set_post_tags', { p_post_id: postId, p_tag_names: names });
	if (error) throw error;
}

interface SimilarRow {
	tag_id: string;
	posts: {
		id: string;
		title: string;
		created_at: string;
		post_media: Parameters<typeof readyMedia>[0];
	} | null;
}

/** Approved posts that share tags with `postId`, ranked by overlap (most shared first).
 *  Coarse DB filter (candidates sharing ≥1 tag) + pure `findSimilar`; only re-encoded
 *  cover URLs are exposed, and non-approved posts are excluded for every viewer. */
export async function getSimilarPosts(
	client: DbClient,
	postId: string,
	limit: number = SIMILAR_LIMIT
): Promise<BoardCard[]> {
	const { data: tagRows, error: tagErr } = await client
		.from('post_tags')
		.select('tag_id')
		.eq('post_id', postId);
	if (tagErr) throw tagErr;

	const targetTagIds = (tagRows ?? []).map((row) => row.tag_id);
	if (targetTagIds.length === 0) return [];

	const { data, error } = await client
		.from('post_tags')
		.select(`tag_id, posts!inner(id, title, created_at, ${MEDIA_EMBED})`)
		.in('tag_id', targetTagIds)
		.neq('post_id', postId)
		.eq('posts.moderation_state', 'approved')
		.limit(SIMILAR_CANDIDATE_CAP);
	if (error) throw error;

	return findSimilar(targetTagIds, toCandidates((data ?? []) as SimilarRow[]), limit);
}

/** Fold the per-(post, shared-tag) rows into one candidate per post: collect its shared
 *  tag ids and build its cover card once. Posts without a ready cover are dropped. */
function toCandidates(rows: SimilarRow[]): SimilarCandidate[] {
	const byPost = new Map<string, SimilarCandidate>();
	for (const row of rows) {
		const post = row.posts;
		if (!post) continue;

		const existing = byPost.get(post.id);
		if (existing) {
			existing.tagIds.push(row.tag_id);
			continue;
		}

		const cover: ReadyMedia | undefined = readyMedia(post.post_media)[0];
		if (!cover) continue;
		byPost.set(post.id, {
			card: { id: post.id, title: post.title, ...coverFields(cover) },
			createdAt: post.created_at,
			tagIds: [row.tag_id]
		});
	}
	return [...byPost.values()];
}
