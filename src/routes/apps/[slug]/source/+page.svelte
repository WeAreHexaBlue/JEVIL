<script lang="ts">
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();

    const json = $derived(JSON.stringify(data.source, null, 2));
</script>

<svelte:head>
    <title>{m.source_title()} — {data.title} — JEVIL</title>
    <meta name="description" content={m.source_hint()} />
</svelte:head>

<section class="container-page py-8 md:py-12">
    <nav aria-label="Breadcrumb" class="mb-6">
        <ol class="flex flex-wrap items-center gap-2 font-mono text-micro text-muted">
            <li>
                <a class="hover:text-ink" href={resolve("/apps")}>{m.app_detail_breadcrumb()}</a>
            </li>
            <li aria-hidden="true">/</li>
            <li>
                <a class="hover:text-ink" href={resolve("/apps/[slug]", { slug: data.slug })}>
                    {data.title}
                </a>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" class="text-ink-2">{m.source_title()}</li>
        </ol>
    </nav>

    <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <h1 class="text-h1">{m.source_title()}</h1>
            <p class="measure mt-2 text-body text-ink-2">{m.source_hint()}</p>
        </div>
        <Button variant="secondary" href={resolve("/apps/[slug]", { slug: data.slug })}>
            {m.source_back({ title: data.title })}
        </Button>
    </div>

    <pre
        class="mt-8 overflow-x-auto rounded-md border border-night/20 bg-night p-5 font-mono text-small leading-relaxed text-on-night"><code
            >{json}</code
        ></pre>
</section>
