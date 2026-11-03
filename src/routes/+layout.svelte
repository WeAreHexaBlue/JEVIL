<script lang="ts">
    import "@fontsource-variable/bricolage-grotesque";
    import "@fontsource-variable/instrument-sans";
    import "@fontsource-variable/jetbrains-mono";
    import "../app.css";

    import favicon from "#lib/assets/favicon.svg";
    import SiteFooter from "#lib/components/SiteFooter.svelte";
    import SiteHeader from "#lib/components/SiteHeader.svelte";
    import { m } from "#lib/paraglide/messages";
    import { theme } from "#lib/theme.svelte";
    import { onMount } from "svelte";
    import type { LayoutProps } from "./$types";

    let { children, data }: LayoutProps = $props();

    onMount(() => theme.init());
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <meta name="theme-color" content="#f7f4ff" />
</svelte:head>

<a
    href="#main"
    class="sr-only rounded-full bg-ink px-4 py-2 text-small font-semibold text-paper focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70]"
>
    {m.skip_to_content()}
</a>

<div class="flex min-h-dvh flex-col">
    <SiteHeader user={data.user} />
    <main id="main" tabindex="-1" class="flex-1 outline-none">
        {@render children()}
    </main>
    <SiteFooter />
</div>
