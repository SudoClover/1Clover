/**
 * Pure "similar posts" ranking by tag overlap (ARCHITECTURE.md §4.2 — Slice 4). No I/O:
 * the server layer does the coarse DB fetch (candidates that share ≥1 tag), this ranks
 * them deterministically. `findSimilar` is the STABLE seam — a future pgvector slice
 * swaps the scoring here without touching any caller.
 */
import type { BoardCard } from '../posts/types';

export interface SimilarCandidate {
	card: BoardCard;
	createdAt: string;
	tagIds: string[];
}

/**
 * Rank candidates by how many tags they share with the target, most-shared first.
 * Deterministic tie-break: newer `createdAt`, then higher `id` — so equal-overlap posts
 * always order the same way. Candidates with zero shared tags are dropped.
 */
export function findSimilar(
	targetTagIds: string[],
	candidates: SimilarCandidate[],
	limit: number
): BoardCard[] {
	const target = new Set(targetTagIds);
	return candidates
		.map((candidate) => ({
			candidate,
			shared: candidate.tagIds.reduce((count, id) => (target.has(id) ? count + 1 : count), 0)
		}))
		.filter((scored) => scored.shared > 0)
		.sort(
			(a, b) =>
				b.shared - a.shared ||
				b.candidate.createdAt.localeCompare(a.candidate.createdAt) ||
				b.candidate.card.id.localeCompare(a.candidate.card.id)
		)
		.slice(0, limit)
		.map((scored) => scored.candidate.card);
}
