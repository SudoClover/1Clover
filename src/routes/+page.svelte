<script lang="ts">
	import Masonry from '$lib/components/Masonry.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import type { BoardCard, BoardCursor, BoardPage } from '$lib/domain/posts/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Seeded from the server-rendered page; the $effect below re-syncs on a fresh load,
	// while loadMore() appends to these without resetting them.
	// svelte-ignore state_referenced_locally
	let cards = $state<BoardCard[]>(data.cards);
	// svelte-ignore state_referenced_locally
	let cursor = $state<BoardCursor | null>(data.nextCursor);
	let loading = $state(false);

	// Re-sync when the server load runs again (e.g. navigating back to the board).
	$effect(() => {
		cards = data.cards;
		cursor = data.nextCursor;
	});

	async function loadMore() {
		if (loading || !cursor) return;
		loading = true;
		const params = new URLSearchParams({ cursor_created: cursor.createdAt, cursor_id: cursor.id });
		const res = await fetch(`/api/board?${params}`);
		if (res.ok) {
			const page: BoardPage = await res.json();
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

	{#if cards.length === 0}
		<p class="empty">No posts on the board yet.</p>
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
