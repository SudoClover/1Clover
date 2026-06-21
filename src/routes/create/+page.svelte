<script lang="ts">
	import type { PostFieldError } from '$lib/domain/posts/post-input';
	import type { PageData } from './$types';
	import type { ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function errorFor(field: PostFieldError['field']): string | undefined {
		return form?.errors?.find((e) => e.field === field)?.message;
	}
</script>

<svelte:head><title>Create a post — Clover</title></svelte:head>

<main>
	<h1>Create a post</h1>

	{#if data.library.length === 0}
		<p>You have no processed images yet.</p>
		<p><a href="/upload">Upload an image</a> first, then come back to post it.</p>
	{:else}
		<form method="POST">
			<label>
				Title
				<input name="title" maxlength="140" required value={form?.title ?? ''} />
			</label>
			{#if errorFor('title')}<p class="error">{errorFor('title')}</p>{/if}

			<label>
				Description (optional)
				<textarea name="description" maxlength="2000" rows="3">{form?.description ?? ''}</textarea>
			</label>
			{#if errorFor('description')}<p class="error">{errorFor('description')}</p>{/if}

			<fieldset>
				<legend>Choose images</legend>
				<div class="picker">
					{#each data.library as item (item.id)}
						<label class="pick">
							<input type="checkbox" name="media" value={item.id} />
							<img src={item.thumb} alt="" loading="lazy" />
						</label>
					{/each}
				</div>
				{#if errorFor('media')}<p class="error">{errorFor('media')}</p>{/if}
			</fieldset>

			<button type="submit">Publish post</button>
		</form>
	{/if}

	<p><a href="/">← Back to the board</a></p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 3rem auto;
		padding: 0 1rem;
		font-family: system-ui, sans-serif;
	}
	label {
		display: block;
		margin: 1rem 0 0.25rem;
		font-weight: 600;
	}
	input[name='title'],
	textarea {
		display: block;
		width: 100%;
		margin-top: 0.25rem;
		font: inherit;
		padding: 0.4rem;
	}
	fieldset {
		margin: 1.5rem 0;
		border: 1px solid #ddd;
		border-radius: 8px;
	}
	.picker {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
		gap: 0.5rem;
	}
	.pick {
		margin: 0;
		font-weight: 400;
		cursor: pointer;
	}
	.pick img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 6px;
	}
	.pick input {
		margin-bottom: 0.25rem;
	}
	button {
		margin-top: 1rem;
		font: inherit;
		padding: 0.5rem 1rem;
	}
	.error {
		color: #b00020;
		margin: 0.25rem 0 0;
	}
</style>
