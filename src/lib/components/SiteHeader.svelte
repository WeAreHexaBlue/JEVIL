<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import * as m from '#lib/paraglide/messages.js';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import Logo from './Logo.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let { user }: { user?: { name: string; email: string } | null } = $props();

	let open = $state(false);
	let scrolled = $state(false);
	let menuButton = $state<HTMLButtonElement | null>(null);
	let panel = $state<HTMLDivElement | null>(null);

	const initial = $derived((user?.name || user?.email || '?').trim().charAt(0).toUpperCase());

	$effect(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 4;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	$effect(() => {
		if (!open) return;

		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};

		document.addEventListener('keydown', onKey);
		document.body.style.overflow = 'hidden';
		panel?.querySelector<HTMLElement>('a, button')?.focus();

		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = '';
		};
	});

	function close() {
		open = false;
		menuButton?.focus();
	}

	const navLinks = $derived([
		{ href: resolve('/apps'), label: m.nav_apps(), path: '/apps' },
		{ href: resolve('/new'), label: m.nav_make(), path: '/new' },
		{ href: resolve('/#how'), label: m.nav_how(), path: '/' }
	]);

	const linkClass = (path: string) =>
		page.url.pathname === path
			? 'text-ink after:scale-x-100'
			: 'text-ink-2 after:scale-x-0 hover:text-ink';
</script>

<header
	class="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm transition-shadow duration-200"
	class:border-b={scrolled}
	class:border-line={scrolled}
>
	<div class="container-page flex h-16 items-center gap-6">
		<a href={resolve('/')} class="rounded-sm" aria-label="JEVIL — home">
			<Logo />
		</a>

		<nav class="hidden items-center gap-1 md:flex" aria-label="Main">
			{#each navLinks as link (link.path)}
				<a
					href={link.href}
					aria-current={page.url.pathname === link.path ? 'page' : undefined}
					class="relative rounded-sm px-3 py-2 text-small font-medium transition-colors after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:origin-left after:bg-brand after:transition-transform after:duration-150 {linkClass(
						link.path
					)}"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="ml-auto hidden items-center gap-2 md:flex">
			<ThemeToggle class="mr-1" />
			{#if user}
				<a
					href={resolve('/me')}
					class="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-small font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
				>
					<span
						class="grid size-8 place-items-center rounded-full bg-[linear-gradient(135deg,#5B21B6,#8B5CF6)] font-display text-small font-bold text-white"
						aria-hidden="true">{initial}</span
					>
					<span class="max-w-32 truncate">{user.name}</span>
				</a>
				<form method="POST" action={resolve('/sign-out')}>
					<Button variant="ghost" type="submit">{m.nav_sign_out()}</Button>
				</form>
			{:else}
				<Button variant="ghost" href={resolve('/sign-in')}>{m.nav_sign_in()}</Button>
				<Button href={resolve('/new')}>{m.nav_make()}</Button>
			{/if}
		</div>

		<div class="ml-auto flex items-center gap-1 md:hidden">
			<Button variant="ghost" href={resolve('/new')} class="px-3">{m.nav_make()}</Button>
			<button
				bind:this={menuButton}
				type="button"
				onclick={() => (open = true)}
				aria-expanded={open}
				aria-controls="mobile-menu"
				class="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-paper-2"
			>
				<Icon name="menu" size={22} label={m.nav_menu()} />
			</button>
		</div>
	</div>
</header>

{#if open}
	<div
		bind:this={panel}
		id="mobile-menu"
		role="dialog"
		aria-modal="true"
		aria-label={m.nav_menu()}
		class="fixed inset-0 z-[60] flex flex-col bg-paper md:hidden"
	>
		<div class="container-page flex h-16 items-center justify-between">
			<Logo />
			<button
				type="button"
				onclick={close}
				class="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-paper-2"
			>
				<Icon name="close" size={22} label={m.nav_close()} />
			</button>
		</div>

		<nav class="container-page flex flex-col gap-1 pt-6" aria-label="Mobile">
			{#each navLinks as link (link.path)}
				<a
					href={link.href}
					onclick={close}
					aria-current={page.url.pathname === link.path ? 'page' : undefined}
					class="rounded-md px-2 py-4 text-center font-display text-h2 font-bold tracking-[-0.03em] text-ink transition-colors hover:bg-paper-2"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div
			class="container-page mt-auto flex flex-col gap-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
		>
			<ThemeToggle variant="full" class="mb-2" />
			{#if user}
				<Button href={resolve('/me')} variant="secondary" fullWidth onclick={close}>
					{m.nav_account()}
				</Button>
				<form method="POST" action={resolve('/sign-out')} class="contents">
					<Button variant="ghost" type="submit" fullWidth>{m.nav_sign_out()}</Button>
				</form>
			{:else}
				<Button href={resolve('/sign-up')} fullWidth onclick={close}>{m.nav_make()}</Button>
				<Button href={resolve('/sign-in')} variant="secondary" fullWidth onclick={close}>
					{m.nav_sign_in()}
				</Button>
			{/if}
		</div>
	</div>
{/if}
