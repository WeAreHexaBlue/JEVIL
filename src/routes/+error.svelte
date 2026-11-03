<script lang="ts">
    import { page } from "$app/state";
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";

    const isNotFound = $derived(page.status === 404);
    const title = $derived(isNotFound ? m.error_404_title() : m.error_500_title());
    const body = $derived(isNotFound ? m.error_404_body() : m.error_500_body());
</script>

<svelte:head>
    <title>{title} — JEVIL</title>
</svelte:head>

<section
    class="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center md:items-start md:text-left"
>
    <p class="eyebrow">{page.status}</p>
    <h1 class="mt-4 max-w-2xl text-h1">{title}</h1>
    <p class="measure mt-4 text-body-lg text-ink-2">{body}</p>
    <div class="mt-8">
        <Button href={resolve("/apps")}>{m.error_cta()}</Button>
    </div>
</section>
