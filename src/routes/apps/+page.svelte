<script lang="ts">
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import EmptyState from "#lib/components/EmptyState.svelte";
    import Icon from "#lib/components/Icon.svelte";
    import { inputClass } from "#lib/components/field-styles";
    import { cn } from "#lib/utils/cn";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();

    const count = $derived(data.apps.length);

    const accentTile: Record<string, string> = {
        blue: "bg-brand-soft text-brand",
        pink: "bg-pink/15 text-pink",
        lime: "bg-lime/25 text-green",
        tangerine: "bg-gold/30 text-gold",
        violet: "bg-brand-soft text-brand",
        sky: "bg-brand-soft text-brand"
    };
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

    {#if data.apps.length > 0}
        <ul class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {#each data.apps as app (app.slug)}
                <li>
                    <a
                        class="group flex h-full flex-col gap-4 rounded-md border border-line bg-paper p-5 transition-[transform,box-shadow,border-color] duration-150 ease-spring hover:-translate-y-0.5 hover:border-ink-2/30 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        href={resolve("/apps/[slug]", { slug: app.slug })}
                    >
                        <div class="flex items-center gap-3">
                            <span
                                class={cn(
                                    "inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-[22px] leading-none",
                                    accentTile[app.accent] ?? accentTile.violet
                                )}
                                aria-hidden="true"
                            >
                                {app.icon}
                            </span>
                            <h2 class="text-h3 text-ink">{app.title}</h2>
                        </div>

                        <p class="text-body text-ink-2">{app.tagline}</p>

                        <div class="mt-auto flex flex-wrap items-center gap-2 pt-2">
                            {#each app.tags as tag (tag)}
                                <span
                                    class="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-micro font-semibold text-ink-2"
                                >
                                    {tag}
                                </span>
                            {/each}
                            <span
                                class="ml-auto inline-flex items-center gap-1 text-small font-semibold text-brand"
                            >
                                {m.apps_open()}
                                <Icon name="arrow-right" size={16} />
                            </span>
                        </div>
                    </a>
                </li>
            {/each}
        </ul>
    {:else}
        <div class="mt-10 rounded-lg border border-dashed border-line bg-paper-2/40 p-8 md:p-12">
            {#if data.q}
                <EmptyState
                    title={m.apps_search_empty_title({ query: data.q })}
                    body={m.apps_search_empty_body()}
                >
                    <Button href={resolve("/apps")} variant="secondary">
                        {m.apps_clear_search()}
                    </Button>
                </EmptyState>
            {:else}
                <EmptyState title={m.apps_empty_title()} body={m.apps_empty_body()}>
                    <Button href={resolve("/new")} variant="secondary">{m.make_cta()}</Button>
                </EmptyState>
            {/if}
        </div>
    {/if}
</section>
