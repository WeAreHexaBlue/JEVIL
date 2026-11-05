<script lang="ts">
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import EmptyState from "#lib/components/EmptyState.svelte";
    import { getLocale } from "#lib/paraglide/runtime.js";
    import type { PageProps } from "./$types";

    let { data, form }: PageProps = $props();

    const initial = $derived(
        (data.profile.displayName || data.profile.handle).charAt(0).toUpperCase()
    );

    const joined = $derived(
        new Intl.DateTimeFormat(getLocale(), { month: "long", year: "numeric" }).format(
            data.profile.createdAt
        )
    );

    const updated = (ms: number): string =>
        new Intl.DateTimeFormat(getLocale(), {
            month: "short",
            day: "numeric",
            year: "numeric"
        }).format(new Date(ms));

    const accentTile: Record<string, string> = {
        blue: "bg-brand-soft text-brand",
        pink: "bg-pink/15 text-pink",
        lime: "bg-lime/25 text-green",
        tangerine: "bg-gold/30 text-gold",
        violet: "bg-brand-soft text-brand",
        sky: "bg-brand-soft text-brand"
    };

    const tabs = $derived([
        {
            id: "published",
            href: resolve("/me?tab=published"),
            label: m.me_tab_published(),
            count: data.counts.published
        },
        {
            id: "drafts",
            href: resolve("/me?tab=drafts"),
            label: m.me_tab_drafts(),
            count: data.counts.drafts
        },
        {
            id: "likes",
            href: resolve("/me?tab=likes"),
            label: m.me_tab_likes(),
            count: data.counts.likes
        }
    ]);

    const empty = $derived.by(() => {
        if (data.tab === "drafts") {
            return {
                title: m.me_drafts_empty_title(),
                body: m.me_drafts_empty_body(),
                cta: m.me_empty_cta(),
                href: resolve("/new")
            };
        }
        if (data.tab === "likes") {
            return {
                title: m.me_likes_empty_title(),
                body: m.me_likes_empty_body(),
                cta: m.me_likes_empty_cta(),
                href: resolve("/apps")
            };
        }
        return {
            title: m.me_empty_title(),
            body: m.me_empty_body(),
            cta: m.me_empty_cta(),
            href: resolve("/new")
        };
    });
</script>

<svelte:head>
    <title>{m.me_title()} — JEVIL</title>
</svelte:head>

<section class="container-page py-12 md:py-16">
    <div
        class="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left"
    >
        <span
            class="grid size-20 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#5B21B6,#8B5CF6)] font-display text-h2 font-bold text-white"
            aria-hidden="true">{initial}</span
        >
        <div>
            <p class="font-mono text-micro text-muted">
                {m.me_handle({ handle: data.profile.handle })}
            </p>
            <h1 class="mt-1 text-h1">{data.profile.displayName}</h1>
            <p class="mt-1 text-small text-muted">
                {m.me_email({ email: data.user.email })} · {m.me_joined({ date: joined })}
            </p>
        </div>
        <div class="sm:ml-auto">
            <Button href={resolve("/settings/connections")} variant="secondary">
                {m.connections_nav()}
            </Button>
        </div>
    </div>

    {#if !data.user.emailVerified}
        <div class="mt-8 rounded-lg border border-line bg-brand-soft p-5 text-center sm:text-left">
            <h2 class="text-h3">{m.me_verify_title()}</h2>
            <p class="mt-1 text-small text-ink-2">{m.me_verify_body({ email: data.user.email })}</p>

            {#if form?.verifySent}
                <p class="mt-3 text-small font-semibold text-brand" role="status">
                    {m.me_verify_sent()}
                </p>
            {:else if form?.error}
                <p class="mt-3 text-small text-red" role="alert">{form.error}</p>
            {:else}
                <form method="POST" action="?/resend" class="mt-4">
                    <Button type="submit" variant="secondary">{m.me_verify_cta()}</Button>
                </form>
            {/if}
        </div>
    {/if}

    <nav
        class="mx-auto mt-10 inline-flex flex-wrap justify-center gap-1 rounded-full bg-paper-2 p-1 sm:mx-0"
        aria-label={m.me_tabs_label()}
    >
        {#each tabs as tab (tab.id)}
            <a
                href={tab.href}
                aria-current={data.tab === tab.id ? "page" : undefined}
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

    {#if data.tab === "drafts" && data.drafts.length > 0}
        <ul class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {#each data.drafts as draft (draft.id)}
                <li>
                    <a
                        class="group flex h-full flex-col gap-3 rounded-md border border-line bg-paper p-5 transition-[transform,box-shadow,border-color] duration-150 ease-spring hover:-translate-y-0.5 hover:border-ink-2/30 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        href={resolve("/edit/[id]", { id: draft.id })}
                    >
                        <div class="flex items-center gap-3">
                            <span
                                class="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-[20px] leading-none {accentTile[
                                    draft.accent
                                ] ?? accentTile.violet}"
                                aria-hidden="true">{draft.icon}</span
                            >
                            <h2 class="text-h3 text-ink">{draft.title}</h2>
                        </div>
                        <p class="text-small text-ink-2">
                            {draft.tagline || m.me_drafts_untitled_tagline()}
                        </p>
                        <p class="mt-auto font-mono text-micro text-muted">
                            {m.me_draft_updated({ date: updated(draft.updatedAt) })}
                        </p>
                    </a>
                </li>
            {/each}
        </ul>
    {:else}
        <div class="mt-8 rounded-lg border border-dashed border-line bg-paper-2/40 p-8 md:p-12">
            <EmptyState title={empty.title} body={empty.body}>
                <Button href={empty.href} variant="secondary">{empty.cta}</Button>
            </EmptyState>
        </div>
    {/if}
</section>
