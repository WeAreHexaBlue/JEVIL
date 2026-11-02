<script lang="ts">
	import * as m from '#lib/paraglide/messages.js';
	import { theme, type ThemeChoice } from '#lib/theme.svelte';
	import { cn } from '#lib/utils/cn';
	import Icon from './Icon.svelte';

	let {
		variant = 'compact',
		class: className = ''
	}: { variant?: 'compact' | 'full'; class?: string } = $props();

	const options = [
		{ value: 'light' as ThemeChoice, icon: 'sun' as const, label: () => m.theme_light() },
		{ value: 'system' as ThemeChoice, icon: 'monitor' as const, label: () => m.theme_system() },
		{ value: 'dark' as ThemeChoice, icon: 'moon' as const, label: () => m.theme_dark() }
	];

	const isActive = (value: ThemeChoice) => theme.choice === value;
</script>

{#if variant === 'compact'}
	<div
		class={cn('inline-flex items-center gap-0.5 rounded-full bg-paper-2 p-1', className)}
		role="group"
		aria-label={m.theme_label()}
	>
		{#each options as option (option.value)}
			<button
				type="button"
				onclick={() => theme.set(option.value)}
				aria-pressed={isActive(option.value)}
				title={option.label()}
				class="grid size-8 place-items-center rounded-full transition-[background-color,color,transform] duration-150 ease-spring active:scale-95 {isActive(
					option.value
				)
					? 'bg-brand text-on-brand shadow-soft'
					: 'text-muted hover:text-ink'}"
			>
				<Icon name={option.icon} size={16} label={option.label()} />
			</button>
		{/each}
	</div>
{:else}
	<div
		class={cn('grid grid-cols-3 gap-1 rounded-full bg-paper-2 p-1', className)}
		role="group"
		aria-label={m.theme_label()}
	>
		{#each options as option (option.value)}
			<button
				type="button"
				onclick={() => theme.set(option.value)}
				aria-pressed={isActive(option.value)}
				class="flex min-h-10 items-center justify-center gap-2 rounded-full px-3 text-small font-semibold transition-[background-color,color,transform] duration-150 ease-spring active:scale-[0.98] {isActive(
					option.value
				)
					? 'bg-brand text-on-brand shadow-soft'
					: 'text-ink-2 hover:text-ink'}"
			>
				<Icon name={option.icon} size={16} />
				<span>{option.label()}</span>
			</button>
		{/each}
	</div>
{/if}
