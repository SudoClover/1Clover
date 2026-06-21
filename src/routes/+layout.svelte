<script lang="ts">
	import { page } from '$app/state';
	let { children } = $props();
</script>

<nav>
	<a href="/">Clover</a>
	<span class="spacer"></span>
	{#if page.data.session}
		<a href="/account">Account</a>
	{:else}
		<a href="/login">Log in</a>
		<a href="/signup">Sign up</a>
	{/if}
</nav>

{@render children()}

<style>
	nav {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e5e5e5;
		font-family: system-ui, sans-serif;
	}
	.spacer {
		flex: 1;
	}
</style>
