<script lang="ts">
	import { cn } from '#lib/utils/cn';

	let {
		class: className = '',
		showWordmark = true,
		tone = 'ink',
		size = 'md',
		wordmarkClass = ''
	}: {
		class?: string;
		showWordmark?: boolean;
		tone?: 'ink' | 'light';
		size?: 'md' | 'lg';
		wordmarkClass?: string;
	} = $props();

	const wordmark = $derived(tone === 'light' ? 'text-on-night' : 'text-ink');
	const uid = $props.id();
	const gradientId = `jevil-mark-${uid}`;
	const clipId = `jevil-hex-${uid}`;
</script>

<span class={cn('inline-flex items-center', size === 'lg' ? 'gap-2' : 'gap-2.5', className)}>
	<svg
		viewBox="0 0 32 32"
		class={size === 'lg' ? 'size-15 shrink-0' : 'size-7 shrink-0'}
		aria-hidden="true"
		focusable="false"
	>
		<defs>
			<linearGradient id={gradientId} x1="3" y1="1" x2="29" y2="31" gradientUnits="userSpaceOnUse">
				<stop stop-color="#5B21B6" />
				<stop offset="0.45" stop-color="#8B5CF6" />
				<stop offset="1" stop-color="#B9F24D" />
			</linearGradient>
			<clipPath id={clipId}>
				<path d="M16 1 29 8.5v15L16 31 3 23.5v-15Z" />
			</clipPath>
		</defs>
		<g clip-path="url(#{clipId})">
			<rect x="3" y="1" width="8.7" height="30" fill="url(#{gradientId})" />
			<rect x="11.7" y="1" width="8.6" height="30" fill="url(#{gradientId})" opacity="0.78" />
			<rect x="20.3" y="1" width="8.7" height="30" fill="url(#{gradientId})" opacity="0.55" />
		</g>
	</svg>
	{#if showWordmark}
		<span
			class={cn(
				'font-display font-bold tracking-[-0.04em]',
				size === 'lg' ? 'text-3xl md:text-5xl md:font-extrabold' : 'text-[1.0625rem]',
				wordmark,
				wordmarkClass
			)}
			aria-hidden="true">JEVIL</span
		>
	{/if}
</span>
