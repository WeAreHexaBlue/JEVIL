<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as m from '#lib/paraglide/messages.js';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	let {
		title,
		providers,
		children
	}: {
		title: string;
		providers: { google: boolean; github: boolean };
		children: Snippet;
	} = $props();

	const hasOAuth = $derived(providers.google || providers.github);

	const swatches = ['#5B21B6', '#8B5CF6', '#B9F24D', '#FFD93D', '#EF5DA8'];
</script>

<div class="container-page grid gap-12 py-10 md:py-16 lg:grid-cols-12 lg:gap-16">
	<div
		class="flex flex-col items-center justify-center text-center lg:col-span-5 lg:items-start lg:text-left"
	>
		<div class="w-full max-w-md">
			<h1 class="text-h1">{title}</h1>
			<p class="mt-3 text-body text-ink-2">{m.auth_sub()}</p>

			<div class="mt-8 text-left">
				{#if hasOAuth}
					<div class="flex flex-col gap-3">
						{#if providers.github}
							<form method="POST" action="?/github">
								<Button variant="ink" type="submit" fullWidth>
									<Icon name="github" size={18} />
									{m.auth_github()}
								</Button>
							</form>
						{/if}
						{#if providers.google}
							<form method="POST" action="?/google">
								<Button variant="secondary" type="submit" fullWidth>
									<Icon name="google" size={18} />
									{m.auth_google()}
								</Button>
							</form>
						{/if}
					</div>

					<div class="my-6 flex items-center gap-4" aria-hidden="true">
						<span class="h-px flex-1 bg-line"></span>
						<span class="font-mono text-micro tracking-[0.08em] text-muted uppercase"
							>{m.auth_or()}</span
						>
						<span class="h-px flex-1 bg-line"></span>
					</div>
				{/if}

				{@render children()}
			</div>
		</div>
	</div>

	<div class="hidden lg:col-span-7 lg:block">
		<div
			class="sticky top-24 flex h-[min(600px,calc(100dvh-8rem))] flex-col justify-between overflow-hidden rounded-lg border border-line bg-paper-2 p-10"
		>
			<div class="flex gap-1.5" aria-hidden="true">
				{#each swatches as colour (colour)}
					<span class="h-20 flex-1 rounded-md" style="background-color: {colour}"></span>
				{/each}
			</div>

			<figure class="max-w-md">
				<blockquote class="font-display text-h2 font-bold text-ink">
					“{m.auth_quote()}”
				</blockquote>
				<figcaption class="mt-4 font-mono text-micro text-muted">
					— {m.auth_quote_attribution()}
				</figcaption>
			</figure>
		</div>
	</div>
</div>
