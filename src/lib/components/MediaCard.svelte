<script lang="ts">
	// One image on the board. `src` is a served (re-encoded, safe) variant URL —
	// never an original. No user text is rendered in Slice 2 (titles arrive in Slice 3).
	interface Props {
		src: string;
		width: number | null;
		height: number | null;
	}
	let { src, width, height }: Props = $props();
</script>

<figure class="card">
	<img
		{src}
		alt="Community upload"
		width={width ?? undefined}
		height={height ?? undefined}
		loading="lazy"
	/>
</figure>

<style>
	.card {
		margin: 0 0 1rem;
		break-inside: avoid;
		border-radius: 8px;
		overflow: hidden;
		background: #f2f2f2;
	}
	.card img {
		display: block;
		width: 100%;
		height: auto;
	}
</style>
