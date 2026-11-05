<script lang="ts">
    import { m } from "#lib/paraglide/messages";
    import { cn } from "#lib/utils/cn";
    import type { PageProps } from "./$types";

    let { data, form }: PageProps = $props();

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
    <title>{m.new_title()} — JEVIL</title>
    <meta name="description" content={m.new_body()} />
</svelte:head>

<section class="container-page py-12 md:py-16">
    <p class="eyebrow">{m.nav_make()}</p>
    <h1 class="mt-4 max-w-2xl text-h1">{m.new_title()}</h1>
    <p class="measure mt-4 text-body-lg text-ink-2">{m.new_body()}</p>

    {#if form?.error}
        <p
            class="measure mt-6 rounded-sm border border-red/40 bg-red/10 px-4 py-3 text-small text-ink"
            role="alert"
        >
            {form.error}
        </p>
    {/if}

    <h2 class="mt-10 font-mono text-micro font-semibold tracking-[0.08em] text-muted uppercase">
        {m.new_pick()}
    </h2>

    <ul class="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {#each data.templates as template (template.id)}
            <li class="h-full">
                <form method="POST" action="?/create" class="h-full">
                    <input type="hidden" name="template" value={template.id} />
                    <button
                        type="submit"
                        class="group flex h-full w-full flex-col gap-4 rounded-md border border-line bg-paper p-5 text-left transition-[transform,box-shadow,border-color] duration-150 ease-spring hover:-translate-y-0.5 hover:border-ink-2/30 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                        <div class="flex items-center gap-3">
                            <span
                                class={cn(
                                    "inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-[22px] leading-none",
                                    accentTile[template.accent] ?? accentTile.violet
                                )}
                                aria-hidden="true"
                            >
                                {template.icon}
                            </span>
                            <h3 class="text-h3 text-ink">{template.title}</h3>
                        </div>

                        <p class="text-body text-ink-2">{template.tagline}</p>

                        {#if template.tags.length > 0}
                            <div class="mt-auto flex flex-wrap items-center gap-2 pt-2">
                                {#each template.tags as tag (tag)}
                                    <span
                                        class="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-micro font-semibold text-ink-2"
                                    >
                                        {tag}
                                    </span>
                                {/each}
                            </div>
                        {/if}

                        <span
                            class="mt-auto text-small font-semibold text-brand group-hover:underline"
                        >
                            {m.new_use()} →
                        </span>
                    </button>
                </form>
            </li>
        {/each}
    </ul>
</section>
