<script lang="ts">
	import { enhance } from '$app/forms';

	interface LoginForm {
		email?: string;
		message?: string;
	}
	let { form }: { form: LoginForm | null } = $props();
</script>

<svelte:head><title>Log in — Clover</title></svelte:head>

<main>
	<h1>Log in</h1>
	<form method="POST" use:enhance>
		<label>Email<input name="email" type="email" value={form?.email ?? ''} required /></label>
		<label>Password<input name="password" type="password" required /></label>
		{#if form?.message}<p class="errors">{form.message}</p>{/if}
		<button type="submit">Log in</button>
	</form>
	<p><a href="/reset">Forgot your password?</a></p>
	<p>No account? <a href="/signup">Sign up</a></p>
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
