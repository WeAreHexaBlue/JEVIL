<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import Button from '#lib/components/Button.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const initial = $derived(
		(data.profile.displayName || data.profile.handle).charAt(0).toUpperCase()
	);

	const joined = $derived(
		new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric' }).format(
			data.profile.createdAt
		)
	);

	const tabs = $derived([
		{
			id: 'published',
			href: resolve('/me?tab=published'),
			label: m.me_tab_published(),
			count: data.counts.published
		},
		{
			id: 'drafts',
			href: resolve('/me?tab=drafts'),
			label: m.me_tab_drafts(),
			count: data.counts.drafts
		},
		{
			id: 'likes',
			href: resolve('/me?tab=likes'),
			label: m.me_tab_likes(),
			count: data.counts.likes
		}
	]);

	const empty = $derived.by(() => {
		if (data.tab === 'drafts') {
			return {
				title: m.me_drafts_empty_title(),
				body: m.me_drafts_empty_body(),
				cta: m.me_empty_cta(),
				href: resolve('/new')
			};
		}
		if (data.tab === 'likes') {
			return {
				title: m.me_likes_empty_title(),
				body: m.me_likes_empty_body(),
				cta: m.me_likes_empty_cta(),
				href: resolve('/apps')
			};
		}
		return {
			title: m.me_empty_title(),
			body: m.me_empty_body(),
			cta: m.me_empty_cta(),
			href: resolve('/new')
		};
	});
</script>

<svelte:head>
	<title>{m.me_title()} — JEVIL</title>
</svelte:head>

<section class="container-page py-12 md:py-16">
	<div class="flex flex-col gap-6 sm:flex-row sm:items-center">
		<span
			class="grid size-20 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#5B21B6,#8B5CF6)] font-display text-h2 font-bold text-white"
			aria-hidden="true">{initial}</span
		>
		<div>
			<p class="font-mono text-micro text-muted">{m.me_handle({ handle: data.profile.handle })}</p>
			<h1 class="mt-1 text-h1">{data.profile.displayName}</h1>
			<p class="mt-1 text-small text-muted">
				{m.me_email({ email: data.user.email })} · {m.me_joined({ date: joined })}
			</p>
		</div>
	</div>

	<nav
		class="mt-10 inline-flex flex-wrap gap-1 rounded-full bg-paper-2 p-1"
		aria-label={m.me_tabs_label()}
	>
		{#each tabs as tab (tab.id)}
			<a
				href={tab.href}
				aria-current={data.tab === tab.id ? 'page' : undefined}
				class="flex items-center gap-2 rounded-full px-4 py-2 text-small font-semibold transition-colors {data.tab ===
				tab.id
					? 'bg-paper text-ink shadow-soft'
					: 'text-ink-2 hover:text-ink'}"
			>
				{tab.label}
				<span class="font-mono text-micro text-muted">{tab.count}</span>
			</a>
		{/each}
	</nav>

	<div class="mt-8 rounded-lg border border-dashed border-line bg-paper-2/40 p-8 md:p-12">
		<EmptyState title={empty.title} body={empty.body}>
			<Button href={empty.href} variant="secondary">{empty.cta}</Button>
		</EmptyState>
	</div>
</section>
