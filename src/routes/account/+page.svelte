<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	interface AccountForm {
		success?: boolean;
		message?: string;
	}
	let { data, form }: { data: PageData; form: AccountForm | null } = $props();
</script>

<svelte:head><title>Your account — Clover</title></svelte:head>

<main>
	<h1>Your account</h1>
	{#if data.profile}
		<p>Signed in as <strong>{data.profile.username}</strong></p>
		<form method="POST" action="?/updateProfile" use:enhance>
			<label>
				Display name
				<input name="display_name" value={data.profile.display_name ?? ''} maxlength="50" />
			</label>
			<label>
				Bio
				<textarea name="bio" maxlength="500">{data.profile.bio ?? ''}</textarea>
			</label>
			{#if form?.success}<p class="ok">Saved.</p>{/if}
			{#if form?.message}<p class="errors">{form.message}</p>{/if}
			<button type="submit">Save</button>
		</form>
	{:else}
		<p>Profile not found.</p>
	{/if}

	<form method="POST" action="/logout" use:enhance>
		<button type="submit">Log out</button>
	</form>
</main>

<style>
	main {
		max-width: 28rem;
		margin: 3rem auto;
		font-family: system-ui, sans-serif;
	}
	label {
		display: block;
		margin: 0.75rem 0;
	}
	input,
	textarea {
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
