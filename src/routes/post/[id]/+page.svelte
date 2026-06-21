<script lang="ts">
	import { enhance } from '$app/forms';
	import PostDetail from '$lib/components/PostDetail.svelte';
	import type { PostFieldError } from '$lib/domain/posts/post-input';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);

	function errorFor(field: PostFieldError['field']): string | undefined {
		return form?.errors?.find((e) => e.field === field)?.message;
	}
</script>

<svelte:head><title>{data.post.title} — Clover</title></svelte:head>

<main>
	<p><a href="/">← Back to the board</a></p>

	<PostDetail post={data.post} />

	{#if data.isOwner}
		<section class="owner">
			{#if editing}
				<form
					method="POST"
					action="?/edit"
					use:enhance={() =>
						async ({ update, result }) => {
							await update();
							if (result.type === 'success') editing = false;
						}}
				>
					<label>
						Title
						<input name="title" maxlength="140" required value={data.post.title} />
					</label>
					{#if errorFor('title')}<p class="error">{errorFor('title')}</p>{/if}

					<label>
						Description
						<textarea name="description" maxlength="2000" rows="3"
							>{data.post.description ?? ''}</textarea
						>
					</label>
					{#if errorFor('description')}<p class="error">{errorFor('description')}</p>{/if}

					<div class="actions">
						<button type="submit">Save</button>
						<button type="button" onclick={() => (editing = false)}>Cancel</button>
					</div>
				</form>
			{:else}
				<div class="actions">
					<button type="button" onclick={() => (editing = true)}>Edit</button>
					<form
						method="POST"
						action="?/delete"
						use:enhance
						onsubmit={(e) => {
							if (!confirm('Delete this post? This cannot be undone.')) e.preventDefault();
						}}
					>
						<button type="submit" class="danger">Delete</button>
					</form>
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 48rem;
		margin: 2rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	.owner {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid #eee;
	}
	label {
		display: block;
		margin: 0.75rem 0 0.25rem;
		font-weight: 600;
	}
	input,
	textarea {
		display: block;
		width: 100%;
		font: inherit;
		padding: 0.4rem;
	}
	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-top: 1rem;
	}
	button {
		font: inherit;
		padding: 0.4rem 0.9rem;
	}
	.danger {
		color: #b00020;
	}
	.error {
		color: #b00020;
		margin: 0.25rem 0 0;
	}
</style>
