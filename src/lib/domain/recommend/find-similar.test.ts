import { describe, expect, it } from 'vitest';
import { findSimilar, type SimilarCandidate } from './find-similar';
import type { BoardCard } from '../posts/types';

function candidate(id: string, createdAt: string, tagIds: string[]): SimilarCandidate {
	const card: BoardCard = { id, title: id, cover: `/media/${id}.webp`, width: 10, height: 10 };
	return { card, createdAt, tagIds };
}

describe('findSimilar', () => {
	const target = ['t1', 't2', 't3'];

	it('orders by shared-tag count, most overlap first', () => {
		const result = findSimilar(
			target,
			[
				candidate('a', '2026-01-01T00:00:00Z', ['t1']),
				candidate('b', '2026-01-01T00:00:00Z', ['t1', 't2', 't3']),
				candidate('c', '2026-01-01T00:00:00Z', ['t1', 't2'])
			],
			10
		);
		expect(result.map((c) => c.id)).toEqual(['b', 'c', 'a']);
	});

	it('drops candidates with no shared tags', () => {
		const result = findSimilar(
			target,
			[
				candidate('a', '2026-01-01T00:00:00Z', ['t1']),
				candidate('x', '2026-01-01T00:00:00Z', ['other'])
			],
			10
		);
		expect(result.map((c) => c.id)).toEqual(['a']);
	});

	it('breaks ties deterministically by recency, then id', () => {
		const result = findSimilar(
			target,
			[
				candidate('a', '2026-01-01T00:00:00Z', ['t1']),
				candidate('c', '2026-03-01T00:00:00Z', ['t2']),
				candidate('b', '2026-03-01T00:00:00Z', ['t3'])
			],
			10
		);
		// same overlap (1): newest first (a is older), then id desc among the tie (c > b).
		expect(result.map((c) => c.id)).toEqual(['c', 'b', 'a']);
	});

	it('respects the limit', () => {
		const result = findSimilar(
			target,
			[
				candidate('a', '2026-01-01T00:00:00Z', ['t1']),
				candidate('b', '2026-01-02T00:00:00Z', ['t2']),
				candidate('c', '2026-01-03T00:00:00Z', ['t3'])
			],
			2
		);
		expect(result).toHaveLength(2);
		expect(result.map((c) => c.id)).toEqual(['c', 'b']);
	});

	it('returns empty when the target has no tags', () => {
		expect(findSimilar([], [candidate('a', '2026-01-01T00:00:00Z', ['t1'])], 10)).toEqual([]);
	});
});
