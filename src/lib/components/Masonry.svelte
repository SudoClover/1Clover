<script lang="ts">
	// A column-based masonry layout. Children opt out of column breaks themselves
	// (`break-inside: avoid`). Purely presentational — no data logic here.
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="masonry">
	{@render children()}
</div>

<style>
	.masonry {
		column-count: 4;
		column-gap: 1rem;
	}
	@media (max-width: 60rem) {
		.masonry {
			column-count: 3;
		}
	}
	@media (max-width: 40rem) {
		.masonry {
			column-count: 2;
		}
	}
</style>
