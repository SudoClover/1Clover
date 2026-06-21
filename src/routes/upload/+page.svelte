<script lang="ts">
	// Minimal upload UI: POST one image to /api/upload, then show its processing
	// status. The board shows the card once the pipeline approves it.
	type Status = 'idle' | 'uploading' | 'queued' | 'error';
	let status = $state<Status>('idle');
	let message = $state('');

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		const formEl = event.currentTarget as HTMLFormElement;
		const input = formEl.elements.namedItem('file') as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		status = 'uploading';
		message = '';
		const body = new FormData();
		body.append('file', file);
		const res = await fetch('/api/upload', { method: 'POST', body });

		if (res.ok) {
			status = 'queued';
			message = 'Uploaded — processing. It appears on the board once approved.';
			formEl.reset();
		} else {
			status = 'error';
			message = (await res.text()) || 'Upload failed.';
		}
	}
</script>

<svelte:head><title>Upload — Clover</title></svelte:head>

<main>
	<h1>Upload an image</h1>
	<form onsubmit={onSubmit}>
		<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
		<button type="submit" disabled={status === 'uploading'}>
			{status === 'uploading' ? 'Uploading…' : 'Upload'}
		</button>
	</form>

	{#if message}
		<p class:error={status === 'error'} role="status">{message}</p>
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
	form {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin: 1.5rem 0;
	}
	.error {
		color: #b00020;
	}
</style>
