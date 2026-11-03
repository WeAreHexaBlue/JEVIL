<script lang="ts">
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import Icon from "#lib/components/Icon.svelte";
    import { errorClass } from "#lib/components/field-styles";
    import type { PageProps } from "./$types";

    let { data, form }: PageProps = $props();

    const state = $derived.by(() => {
        if (data.failed) {
            return {
                icon: "alert" as const,
                title: m.verify_error_title(),
                body: m.verify_error_body()
            };
        }
        if (data.verified) {
            return {
                icon: "check" as const,
                title: m.verify_ok_title(),
                body: m.verify_ok_body()
            };
        }
        return {
            icon: "mail" as const,
            title: m.verify_title(),
            body: data.email ? m.verify_body({ email: data.email }) : m.verify_body_generic()
        };
    });
</script>

<svelte:head>
    <title>{state.title} — JEVIL</title>
</svelte:head>

<section class="container-page flex justify-center py-16 md:py-24">
    <div class="w-full max-w-md rounded-lg border border-line bg-paper p-6 text-center sm:p-8">
        <span
            class="mx-auto grid size-12 place-items-center rounded-full bg-paper-2 text-brand"
            aria-hidden="true"
        >
            <Icon name={state.icon} size={24} />
        </span>

        <h1 class="mt-5 text-h2">{state.title}</h1>
        <p class="mt-3 text-body text-ink-2">{state.body}</p>

        {#if form?.error}
            <p class={`${errorClass} mt-5 text-left`} role="alert">{form.error}</p>
        {:else if form?.sent}
            <p class="mt-5 rounded-sm bg-brand-soft px-3 py-2 text-small text-ink" role="status">
                {m.verify_sent()}
            </p>
        {/if}

        <div class="mt-8 flex flex-col gap-3">
            {#if data.verified}
                <Button href={resolve("/me")}>{m.verify_continue()}</Button>
            {:else if data.email}
                <form method="POST" action="?/resend">
                    <Button type="submit" variant="secondary" fullWidth>{m.verify_resend()}</Button>
                </form>
            {:else}
                <Button href={resolve("/sign-in")}>{m.nav_sign_in()}</Button>
            {/if}
        </div>
    </div>
</section>
