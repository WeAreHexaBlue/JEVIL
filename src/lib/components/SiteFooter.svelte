<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import Logo from './Logo.svelte';

	const year = new Date().getFullYear();

	const navLinks = [
		{ href: resolve('/apps'), label: m.footer_apps() },
		{ href: resolve('/new'), label: m.footer_make() },
		{ href: resolve('/#how'), label: m.footer_how() }
	];
</script>

<footer class="mt-24 rounded-t-[2rem] bg-night px-6 pt-12 pb-8 text-on-night">
	<div class="mx-auto grid max-w-3xl justify-items-center gap-5 text-center">
		<div class="flex gap-1.5" aria-hidden="true">
			<span class="size-2 rounded-full bg-[#8b5cf6]"></span>
			<span class="size-2 rounded-full bg-lime"></span>
			<span class="size-2 rounded-full bg-gold"></span>
		</div>

		<a href={resolve('/')} class="rounded-sm" aria-label="JEVIL — home">
			<Logo tone="light" />
		</a>

		<p class="text-small text-on-night/70">{m.footer_tagline()}</p>

		<p class="max-w-xl text-small text-on-night/70">{m.footer_license()}</p>

		<p class="max-w-xl text-small text-on-night/70">
			{m.footer_stay()}
			<a
				href="https://github.com/jevil-app/jevil"
				rel="noopener noreferrer"
				target="_blank"
				class="text-gradient font-semibold underline decoration-lime/60 underline-offset-4 hover:decoration-gold"
				>{m.footer_stay_link()}</a
			>
		</p>

		<nav
			class="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-small"
			aria-label={m.footer_nav_label()}
		>
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					class="text-on-night/70 underline-offset-4 hover:text-on-night hover:underline"
					>{link.label}</a
				>
			{/each}
			<a
				href="https://github.com/jevil-app/jevil"
				rel="noopener noreferrer"
				target="_blank"
				class="text-on-night/70 underline-offset-4 hover:text-on-night hover:underline"
				>{m.footer_github()}</a
			>
		</nav>
	</div>

	<div
		class="mx-auto mt-8 flex w-full max-w-3xl flex-col items-center justify-between gap-2 border-t border-on-night/10 pt-5 text-micro text-on-night/50 sm:flex-row"
	>
		<p class="font-mono">{m.footer_rights({ year })}</p>
		<a
			href="https://hexa.blue"
			rel="noopener noreferrer"
			target="_blank"
			class="font-mono underline-offset-4 hover:text-on-night hover:underline"
			>{m.footer_hexablue()}</a
		>
	</div>
</footer>
