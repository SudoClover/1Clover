<script lang="ts">
	import { enhance } from '$app/forms';

	interface ResetForm {
		success?: boolean;
	}
	let { form }: { form: ResetForm | null } = $props();
</script>

<svelte:head><title>Reset password — Clover</title></svelte:head>

<main>
	<h1>Reset your password</h1>
	{#if form?.success}
		<p class="ok">If that email has an account, we've sent a reset link.</p>
	{:else}
		<form method="POST" use:enhance>
			<label>Email<input name="email" type="email" required /></label>
			<button type="submit">Send reset link</button>
		</form>
	{/if}
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
	.ok {
		color: #006400;
	}
</style>
