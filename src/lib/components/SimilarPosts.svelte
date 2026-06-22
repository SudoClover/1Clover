<script lang="ts">
	import PostCard from '$lib/components/PostCard.svelte';
	import type { BoardCard } from '$lib/domain/posts/types';
	// Each card links to its own post. Nothing renders when there are no similar posts.
	let { posts }: { posts: BoardCard[] } = $props();
</script>

{#if posts.length > 0}
	<section class="similar">
		<h2>Similar posts</h2>
		<div class="grid">
			{#each posts as card (card.id)}
				<PostCard {card} />
			{/each}
		</div>
	</section>
{/if}

<style>
	.similar {
		margin-top: 2.5rem;
		padding-top: 1rem;
		border-top: 1px solid #eee;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0 0 1rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: 0.75rem;
	}
</style>
