<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { inputClass } from '#lib/components/field-styles';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const count = 0;
</script>

<svelte:head>
	<title>{m.apps_title()} — JEVIL</title>
	<meta name="description" content={m.apps_empty_body()} />
</svelte:head>

<section class="container-page py-12 md:py-16">
	<div
		class="flex flex-col items-center gap-6 text-center md:flex-row md:items-end md:justify-between md:text-left"
	>
		<div>
			<h1 class="text-h1">{m.apps_title()}</h1>
			<p class="mt-2 font-mono text-micro text-muted">{m.apps_count({ count })}</p>
		</div>

		<form method="GET" role="search" class="mx-auto flex w-full max-w-md gap-2 md:mx-0">
			<div class="relative flex-1">
				<label for="app-search" class="sr-only">{m.apps_search_label()}</label>
				<Icon
					name="search"
					size={18}
					class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"
				/>
				<input
					id="app-search"
					name="q"
					type="search"
					value={data.q}
					placeholder={m.apps_search_placeholder()}
					class={inputClass}
					style="padding-left: 2.75rem"
				/>
			</div>
			<Button type="submit" variant="secondary">{m.apps_search_submit()}</Button>
		</form>
	</div>

	<div class="mt-10 rounded-lg border border-dashed border-line bg-paper-2/40 p-8 md:p-12">
		{#if data.q}
			<EmptyState
				title={m.apps_search_empty_title({ query: data.q })}
				body={m.apps_search_empty_body()}
			>
				<Button href={resolve('/apps')} variant="secondary">{m.apps_clear_search()}</Button>
			</EmptyState>
		{:else}
			<EmptyState title={m.apps_empty_title()} body={m.apps_empty_body()}>
				<Button href={resolve('/new')} variant="secondary">{m.make_cta()}</Button>
			</EmptyState>
		{/if}
	</div>
</section>
