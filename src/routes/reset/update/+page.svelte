<script lang="ts">
	import { enhance } from '$app/forms';

	interface UpdateForm {
		message?: string;
	}
	let { form }: { form: UpdateForm | null } = $props();
</script>

<svelte:head><title>New password — Clover</title></svelte:head>

<main>
	<h1>Choose a new password</h1>
	<form method="POST" use:enhance>
		<label>New password<input name="password" type="password" required /></label>
		{#if form?.message}<p class="errors">{form.message}</p>{/if}
		<button type="submit">Update password</button>
	</form>
</main>

<style>
	main {
		max-width: 24rem;
		margin: 3rem auto;
		font-family: system-ui, sans-serif;
	}
	label {
		display: block;
		margin: 0.75rem 0;
	}
	input {
		display: block;
		width: 100%;
	}
	.errors {
		color: #b00020;
	}
</style>
