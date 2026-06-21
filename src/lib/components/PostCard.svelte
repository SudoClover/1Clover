<script lang="ts">
	import type { BoardCard } from '$lib/domain/posts/types';
	// `card.cover` is a re-encoded variant URL (never an original). `card.title` is
	// rendered as text via {title} — never {@html} — so Svelte escapes it and user
	// content cannot inject markup (Slice 3 threat note).
	let { card }: { card: BoardCard } = $props();
</script>

<a class="card" href={`/post/${card.id}`}>
	<img
		src={card.cover}
		alt={card.title}
		width={card.width ?? undefined}
		height={card.height ?? undefined}
		loading="lazy"
	/>
	<span class="title">{card.title}</span>
</a>

<style>
	.card {
		display: block;
		margin: 0 0 1rem;
		break-inside: avoid;
		border-radius: 8px;
		overflow: hidden;
		background: #f2f2f2;
		color: inherit;
		text-decoration: none;
	}
	.card img {
		display: block;
		width: 100%;
		height: auto;
	}
	.title {
		display: block;
		padding: 0.5rem 0.75rem;
		font-size: 0.9rem;
		font-weight: 600;
		line-height: 1.3;
	}
</style>
