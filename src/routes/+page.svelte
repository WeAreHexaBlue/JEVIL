<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import PreviewStack from '#lib/components/PreviewStack.svelte';

	const steps = $derived([
		{ title: m.how_step_1_title(), body: m.how_step_1_body() },
		{ title: m.how_step_2_title(), body: m.how_step_2_body() },
		{ title: m.how_step_3_title(), body: m.how_step_3_body() }
	]);
</script>

<svelte:head>
	<title>JEVIL — {m.hero_title()}</title>
	<meta name="description" content={m.hero_sub()} />
	<meta property="og:title" content="JEVIL — {m.hero_title()}" />
	<meta property="og:description" content={m.hero_sub()} />
</svelte:head>

<section
	class="container-page grid items-center gap-14 pt-12 pb-16 md:grid-cols-12 md:gap-8 md:pt-20 md:pb-24"
>
	<div class="md:col-span-7">
		<p class="eyebrow">{m.hero_eyebrow()}</p>
		<h1 class="mt-5 max-w-[11ch] text-display-xl font-bold text-ink">{m.hero_title()}</h1>
		<p class="measure mt-6 text-body-lg text-ink-2">{m.hero_sub()}</p>

		<div class="mt-8 flex flex-wrap gap-3">
			<Button size="lg" href={resolve('/apps')}>
				{m.hero_cta_primary()}
				<Icon name="arrow-right" size={18} />
			</Button>
			<Button size="lg" variant="secondary" href={resolve('/new')}>{m.hero_cta_secondary()}</Button>
		</div>

		<p class="mt-8 font-mono text-micro text-muted">{m.hero_models()}</p>
	</div>

	<div class="md:col-span-5">
		<PreviewStack />
	</div>
</section>

<section id="how" class="border-y border-line bg-paper-2/50">
	<div class="container-page py-16 md:py-24">
		<p class="eyebrow">{m.how_title()}</p>

		<div class="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
			{#each steps as step, index (step.title)}
				<div>
					<p
						class="font-display text-[4.5rem] leading-none font-bold tracking-[-0.06em] text-paper-3 md:text-[5rem]"
						aria-hidden="true"
					>
						{String(index + 1).padStart(2, '0')}
					</p>
					<h2 class="mt-3 text-h3">{step.title}</h2>
					<p class="measure mt-2 text-body text-ink-2">{step.body}</p>
				</div>
			{/each}
		</div>
	</div>
</section>

<section class="container-page py-16 md:py-24">
	<p class="eyebrow">{m.featured_title()}</p>
	<h2 class="mt-3 text-h2">{m.featured_sub()}</h2>

	<div class="mt-10 rounded-lg border border-dashed border-line bg-paper-2/40 p-8 md:p-12">
		<EmptyState title={m.featured_empty_title()} body={m.featured_empty_body()}>
			<Button href={resolve('/new')} variant="secondary">{m.make_cta()}</Button>
		</EmptyState>
	</div>
</section>

<section class="container-page pb-4">
	<div class="dotted-grid rounded-lg border border-line bg-paper-2/60 p-8 md:p-14">
		<div class="max-w-xl">
			<h2 class="text-h2">{m.make_title()}</h2>
			<p class="mt-3 text-body-lg text-ink-2">{m.make_body()}</p>
			<Button class="mt-7" href={resolve('/new')}>
				{m.make_cta()}
				<Icon name="arrow-up-right" size={18} />
			</Button>
		</div>
	</div>
</section>
