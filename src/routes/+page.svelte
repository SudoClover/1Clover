<script lang="ts">
	import Masonry from '$lib/components/Masonry.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import FeedSwitcher from '$lib/components/FeedSwitcher.svelte';
	import type { BoardCard } from '$lib/domain/posts/types';
	import type { BoardCursor, HotCursor } from '$lib/domain/feed/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type FeedCursor = BoardCursor | HotCursor;

	// Seeded from the server-rendered page; the $effect re-syncs on a fresh load (e.g.
	// switching feed tabs), while loadMore() appends to these without resetting them.
	// svelte-ignore state_referenced_locally
	let cards = $state<BoardCard[]>(data.cards);
	// svelte-ignore state_referenced_locally
	let cursor = $state<FeedCursor | null>(data.nextCursor);
	let loading = $state(false);

	$effect(() => {
		cards = data.cards;
		cursor = data.nextCursor;
	});

	// Echo the server-issued cursor back as query params, matching the feed's keyset:
	// Hot carries only the last id; the others add (created_at, id). Built in one shot (no
	// mutation) so it stays a plain query string, not reactive state.
	function feedQuery(c: FeedCursor): string {
		const params: Record<string, string> = { mode: data.mode, cursor_id: c.id };
		if (data.mode === 'top') params.window = data.topWindow;
		if ('createdAt' in c) params.cursor_created = c.createdAt;
		return new URLSearchParams(params).toString();
	}

	async function loadMore() {
		if (loading || !cursor) return;
		loading = true;
		const res = await fetch(`/api/feed?${feedQuery(cursor)}`);
		if (res.ok) {
			const page: { cards: BoardCard[]; nextCursor: FeedCursor | null } = await res.json();
			cards = [...cards, ...page.cards];
			cursor = page.nextCursor;
		}
		loading = false;
	}

	// Fetch the next page when the bottom sentinel scrolls into view.
	function sentinel(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) loadMore();
		});
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function emptyMessage(): string {
		if (data.mode === 'following') {
			return data.signedIn
				? "You're not following anyone yet. Follow creators to see their posts here."
				: 'Sign in to see posts from creators you follow.';
		}
		if (data.mode === 'top') return 'No posts in this window yet.';
		return 'No posts on the board yet.';
	}
</script>

<svelte:head>
	<title>Clover</title>
	<meta name="description" content="Clover — a creative imageboard." />
</svelte:head>

<main>
	<header>
		<h1>Clover</h1>
		{#if data.signedIn}
			<a class="action" href="/create">Create a post</a>
		{:else}
			<a class="action" href="/login">Sign in to post</a>
		{/if}
	</header>

	<FeedSwitcher mode={data.mode} topWindow={data.topWindow} signedIn={data.signedIn} />

	{#if cards.length === 0}
		<p class="empty">{emptyMessage()}</p>
	{:else}
		<Masonry>
			{#each cards as card (card.id)}
				<PostCard {card} />
			{/each}
		</Masonry>
		{#if cursor}
			<div use:sentinel class="sentinel" aria-hidden="true"></div>
			{#if loading}<p class="loading">Loading more…</p>{/if}
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 70rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 1.5rem;
	}
	.action {
		font-weight: 600;
	}
	.empty {
		color: #666;
	}
	.sentinel {
		height: 1px;
	}
	.loading {
		text-align: center;
		color: #666;
	}
</style>
