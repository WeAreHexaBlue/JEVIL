<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import hexablue from '#lib/assets/hexablue-white.svg';
	import Logo from './Logo.svelte';

	const navLinks = [
		{ href: resolve('/apps'), label: m.footer_apps() },
		{ href: resolve('/new'), label: m.footer_make() },
		{ href: resolve('/#how'), label: m.footer_how() }
	];

	const linkClass =
		'text-on-night/70 underline-offset-4 transition-colors hover:text-on-night hover:underline';
</script>

<footer
	class="mt-auto grid w-full justify-items-center gap-y-4 rounded-t-4xl bg-night px-6 py-6 text-on-night md:px-0"
>
	<span class="flex items-center gap-4">
		<a
			href={resolve('/')}
			class="inline-flex items-center gap-2 rounded-sm"
			aria-label="JEVIL — home"
		>
			<Logo tone="light" size="lg" wordmarkClass="hidden md:inline" />
		</a>

		<span class="h-10 w-px bg-white/20" aria-hidden="true"></span>

		<a
			href="https://hexa.blue/"
			class="inline-flex items-center gap-2 rounded-sm"
			aria-label="HexaBlue"
		>
			<img src={hexablue} class="size-15" alt="" />
			<span class="hidden font-sans text-3xl font-black tracking-[-0.02em] md:inline">HexaBlue</span
			>
		</a>
	</span>

	<p class="max-w-xl px-2 text-center text-small text-on-night/70">
		<strong class="font-semibold text-on-night">{m.footer_license_app()}</strong
		>{m.footer_license_lead()}
		<i>{m.footer_license_name()}</i>
	</p>

	<nav
		class="flex flex-wrap justify-center gap-x-6 gap-y-2 text-small font-semibold"
		aria-label={m.footer_nav_label()}
	>
		{#each navLinks as link (link.href)}
			<a href={link.href} class={linkClass}>{link.label}</a>
		{/each}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external repository URL -->
		<a href="https://github.com/WeAreHexaBlue/JEVIL" class={linkClass}>{m.footer_github()}</a>
	</nav>
</footer>
