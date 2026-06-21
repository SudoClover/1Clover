<script lang="ts">
	import MediaCard from '$lib/components/MediaCard.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Clover</title>
	<meta name="description" content="Clover — a creative imageboard." />
</svelte:head>

<main>
	<header>
		<h1>Clover</h1>
		{#if data.signedIn}
			<a class="action" href="/upload">Upload an image</a>
		{:else}
			<a class="action" href="/login">Sign in to upload</a>
		{/if}
	</header>

	{#if data.media.length === 0}
		<p class="empty">No images on the board yet.</p>
	{:else}
		<section class="board">
			{#each data.media as item (item.id)}
				<MediaCard src={item.thumb} width={item.width} height={item.height} />
			{/each}
		</section>
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
	.board {
		column-count: 4;
		column-gap: 1rem;
	}
	@media (max-width: 60rem) {
		.board {
			column-count: 3;
		}
	}
	@media (max-width: 40rem) {
		.board {
			column-count: 2;
		}
	}
</style>
