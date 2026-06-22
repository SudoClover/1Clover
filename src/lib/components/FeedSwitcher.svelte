<!--
	Feed mode tabs (Slice 5): New / Hot / Top / Following. Each tab is a plain link to
	`/?mode=…`, so switching is an ordinary navigation the server load handles (SSR-first,
	shareable URLs). Top adds a day/week/all sub-selector. Following only shows when signed
	in. Pure presentation — no data fetching here.
-->
<script lang="ts">
	import type { FeedMode, TopWindow } from '$lib/domain/feed/types';

	let { mode, topWindow, signedIn }: { mode: FeedMode; topWindow: TopWindow; signedIn: boolean } =
		$props();

	const tabs: { id: FeedMode; label: string }[] = [
		{ id: 'new', label: 'New' },
		{ id: 'hot', label: 'Hot' },
		{ id: 'top', label: 'Top' },
		{ id: 'following', label: 'Following' }
	];
	const windows: { id: TopWindow; label: string }[] = [
		{ id: 'day', label: 'Today' },
		{ id: 'week', label: 'This week' },
		{ id: 'all', label: 'All time' }
	];

	function href(target: FeedMode, win: TopWindow = topWindow): string {
		return target === 'top' ? `/?mode=top&window=${win}` : `/?mode=${target}`;
	}
</script>

<nav class="feeds" aria-label="Feed mode">
	{#each tabs as tab (tab.id)}
		{#if tab.id !== 'following' || signedIn}
			<a
				class="tab"
				class:active={mode === tab.id}
				href={href(tab.id)}
				aria-current={mode === tab.id ? 'page' : undefined}>{tab.label}</a
			>
		{/if}
	{/each}
</nav>

{#if mode === 'top'}
	<nav class="windows" aria-label="Top window">
		{#each windows as win (win.id)}
			<a class="win" class:active={topWindow === win.id} href={href('top', win.id)}>{win.label}</a>
		{/each}
	</nav>
{/if}

<style>
	.feeds {
		display: flex;
		gap: 0.25rem;
		border-bottom: 1px solid #e5e5e5;
		margin-bottom: 1rem;
	}
	.tab {
		padding: 0.5rem 0.9rem;
		font-weight: 600;
		color: #666;
		text-decoration: none;
		border-bottom: 2px solid transparent;
	}
	.tab.active {
		color: #111;
		border-bottom-color: #111;
	}
	.windows {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
	}
	.win {
		font-size: 0.875rem;
		color: #666;
		text-decoration: none;
	}
	.win.active {
		color: #111;
		font-weight: 600;
	}
</style>
