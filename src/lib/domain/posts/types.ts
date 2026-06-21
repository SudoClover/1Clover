/**
 * Shared view contracts for posts — produced by the server data layer
 * (`$lib/server/db/posts`) and consumed by the route loaders + UI components. Pure
 * types only, so they are safe to import on the client (no server-only code leaks).
 *
 * `cover`/`src`/`thumb` are always re-encoded variant URLs, never original keys.
 */

export interface BoardCursor {
	createdAt: string;
	id: string;
}

export interface BoardCard {
	id: string;
	title: string;
	cover: string;
	width: number | null;
	height: number | null;
}

export interface BoardPage {
	cards: BoardCard[];
	nextCursor: BoardCursor | null;
}

export interface PostMediaView {
	id: string;
	src: string;
	width: number | null;
	height: number | null;
}

export interface PostView {
	id: string;
	title: string;
	description: string | null;
	authorId: string;
	createdAt: string;
	editedAt: string | null;
	media: PostMediaView[];
}

export interface LibraryItem {
	id: string;
	thumb: string;
	width: number | null;
	height: number | null;
}
