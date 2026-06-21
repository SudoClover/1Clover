<script lang="ts">
	import type { PostView } from '$lib/domain/posts/types';
	// Presentational only. Title/description render as text ({…}), never {@html}, so
	// Svelte escapes user content (Slice 3 threat note). `m.src` is a safe variant URL.
	let { post }: { post: PostView } = $props();
	const posted = $derived(new Date(post.createdAt).toLocaleDateString());
</script>

<article class="post">
	<div class="gallery">
		{#each post.media as m (m.id)}
			<img
				src={m.src}
				alt={post.title}
				width={m.width ?? undefined}
				height={m.height ?? undefined}
			/>
		{/each}
	</div>

	<h1>{post.title}</h1>
	<p class="meta">
		Posted {posted}{#if post.editedAt}
			· edited{/if}
	</p>

	{#if post.description}
		<p class="description">{post.description}</p>
	{/if}
</article>

<style>
	.post {
		max-width: 48rem;
	}
	.gallery img {
		display: block;
		width: 100%;
		height: auto;
		margin-bottom: 0.75rem;
		border-radius: 8px;
		background: #f2f2f2;
	}
	h1 {
		margin: 1rem 0 0.25rem;
		font-size: 1.6rem;
	}
	.meta {
		margin: 0 0 1rem;
		color: #666;
		font-size: 0.85rem;
	}
	.description {
		white-space: pre-wrap;
		line-height: 1.5;
	}
</style>
