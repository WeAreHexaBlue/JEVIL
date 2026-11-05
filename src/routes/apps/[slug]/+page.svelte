<script lang="ts">
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import RunnerShell from "#lib/components/RunnerShell.svelte";
    import { providerName } from "#lib/connections/labels";
    import { cn } from "#lib/utils/cn";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();

    const meta = $derived(data.blueprint.meta);
    const engine = $derived(
        meta.engine.recommended?.length
            ? meta.engine.recommended.map((provider) => providerName(provider))
            : ["Jev", "Laya", "Clef"]
    );

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
    <title>{meta.title} — JEVIL</title>
    <meta name="description" content={meta.description ?? meta.tagline} />
</svelte:head>

<section class="container-page py-8 md:py-12">
    <nav aria-label="Breadcrumb" class="mb-6">
        <ol class="flex flex-wrap items-center gap-2 font-mono text-micro text-muted">
            <li>
                <a class="hover:text-ink" href={resolve("/apps")}>{m.app_detail_breadcrumb()}</a>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" class="text-ink-2">{meta.title}</li>
        </ol>
    </nav>

    <div class="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div class="lg:col-span-7">
            <RunnerShell
                blueprint={data.blueprint}
                accountConnections={data.connections}
                signedIn={data.signedIn}
                initialInputs={data.inputs}
            />
        </div>

        <aside class="flex flex-col gap-6 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
            <div class="flex flex-col gap-5 rounded-lg border border-line bg-paper p-6 md:p-7">
                <div class="flex items-start gap-4">
                    <span
                        class={cn(
                            "inline-flex size-14 shrink-0 items-center justify-center rounded-md text-[28px] leading-none",
                            accentTile[meta.accent] ?? accentTile.violet
                        )}
                        aria-hidden="true"
                    >
                        {meta.icon}
                    </span>
                    <div class="min-w-0">
                        <h1 class="text-h2">{meta.title}</h1>
                        <p class="mt-1 text-small text-muted">
                            {m.app_detail_by()} · jevil/app@1
                        </p>
                    </div>
                </div>

                <p class="text-body-lg text-ink-2">{meta.tagline}</p>

                {#if meta.description}
                    <p class="text-body text-ink-2">{meta.description}</p>
                {/if}

                <p class="font-mono text-micro text-muted">
                    {m.app_detail_engine({ list: engine.join(", ") })}
                </p>

                <ul class="flex flex-wrap gap-2" aria-label={m.app_detail_tags()}>
                    {#each meta.tags as tag (tag)}
                        <li
                            class="rounded-full border border-line bg-paper-2 px-3 py-1 text-micro font-semibold text-ink-2"
                        >
                            {tag}
                        </li>
                    {/each}
                </ul>

                <div class="flex flex-wrap gap-3">
                    <Button
                        variant="secondary"
                        href={resolve("/apps/[slug]/source", { slug: data.slug })}
                    >
                        {m.app_detail_source()}
                    </Button>
                </div>
            </div>

            <p class="measure text-small text-muted">{m.app_detail_probability_note()}</p>
        </aside>
    </div>
</section>
