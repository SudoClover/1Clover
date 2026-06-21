import { variantUrl } from '$lib/media-url';
import type { PageServerLoad } from './$types';

interface Variants {
	safe?: string;
	thumb?: string;
}

export interface BoardItem {
	id: string;
	width: number | null;
	height: number | null;
	thumb: string;
}

// The public board: approved + ready media, newest first. RLS already restricts
// anon/other users to approved media; the explicit filter mirrors that and uses
// the partial board index. Only the THUMB variant key is exposed to the client.
export const load: PageServerLoad = async ({ locals }) => {
	const { data, error } = await locals.supabase
		.from('media')
		.select('id, width, height, variants, created_at')
		.eq('moderation_state', 'approved')
		.eq('processing_state', 'ready')
		.order('created_at', { ascending: false })
		.limit(60);

	// A board read failure shouldn't 500 the homepage — show an empty board instead.
	if (error) {
		console.error('[board] media query failed:', error.message);
		return { media: [] satisfies BoardItem[] };
	}

	const media: BoardItem[] = (data ?? [])
		.map((row) => {
			const variants = (row.variants ?? {}) as Variants;
			return {
				id: row.id,
				width: row.width,
				height: row.height,
				thumb: variants.thumb ? variantUrl(variants.thumb) : null
			};
		})
		.filter((item): item is BoardItem => item.thumb !== null);

	return { media };
};
