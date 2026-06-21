<script lang="ts">
	import { enhance } from '$app/forms';

	interface SignupForm {
		success?: boolean;
		email?: string;
		username?: string;
		errors?: { message: string }[];
	}
	let { form }: { form: SignupForm | null } = $props();
</script>

<svelte:head><title>Sign up — Clover</title></svelte:head>

<main>
	<h1>Create your account</h1>
	{#if form?.success}
		<p class="ok">Check your email to confirm your account, then log in.</p>
	{:else}
		<form method="POST" use:enhance>
			<label>Email<input name="email" type="email" value={form?.email ?? ''} required /></label>
			<label>Username<input name="username" value={form?.username ?? ''} required /></label>
			<label>Password<input name="password" type="password" required /></label>
			<label>Date of birth<input name="birthdate" type="date" /></label>
			{#if form?.errors}
				<ul class="errors">
					{#each form.errors as e (e.message)}<li>{e.message}</li>{/each}
				</ul>
			{/if}
			<button type="submit">Sign up</button>
		</form>
		<p>Already have an account? <a href="/login">Log in</a></p>
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
	.errors {
		color: #b00020;
	}
	.ok {
		color: #006400;
	}
</style>
