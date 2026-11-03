<script lang="ts">
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import Icon from "#lib/components/Icon.svelte";
    import { errorClass, inputClass, labelClass } from "#lib/components/field-styles";
    import type { PageProps } from "./$types";

    let { data, form }: PageProps = $props();

    const resetting = $derived(Boolean(data.token));
</script>

<svelte:head>
    <title>{m.reset_title()} — JEVIL</title>
</svelte:head>

<section class="container-page flex justify-center py-16 md:py-24">
    <div class="w-full max-w-md rounded-lg border border-line bg-paper p-6 sm:p-8">
        <span
            class="grid size-12 place-items-center rounded-full bg-paper-2 text-brand"
            aria-hidden="true"
        >
            <Icon name={data.failed ? "alert" : "mail"} size={24} />
        </span>

        {#if form?.sent}
            <h1 class="mt-5 text-h2">{m.reset_sent_title()}</h1>
            <p class="mt-3 text-body text-ink-2">{m.reset_sent_body({ email: form.email })}</p>

            <div class="mt-8">
                <Button href={resolve("/sign-in")} variant="secondary" fullWidth>
                    {m.auth_to_sign_in()}
                </Button>
            </div>
        {:else if data.failed}
            <h1 class="mt-5 text-h2">{m.reset_error_title()}</h1>
            <p class="mt-3 text-body text-ink-2">{m.reset_error_body()}</p>

            <div class="mt-8">
                <Button href={resolve("/reset")} variant="secondary" fullWidth>
                    {m.reset_submit()}
                </Button>
            </div>
        {:else if resetting}
            <h1 class="mt-5 text-h2">{m.reset_new_title()}</h1>
            <p class="mt-3 text-body text-ink-2">{m.reset_new_body()}</p>

            <form method="POST" action="?/reset" class="mt-8 flex flex-col gap-4">
                {#if form?.error}
                    <p class={errorClass} role="alert">{form.error}</p>
                {/if}

                <input type="hidden" name="token" value={data.token ?? ""} />

                <div class="flex flex-col gap-1.5">
                    <label for="password" class={labelClass}>{m.auth_password()}</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autocomplete="new-password"
                        minlength="8"
                        required
                        class={inputClass}
                    />
                    <p class="text-small text-muted">{m.auth_password_hint()}</p>
                </div>

                <Button type="submit" fullWidth>{m.reset_new_submit()}</Button>
            </form>
        {:else}
            <h1 class="mt-5 text-h2">{m.reset_title()}</h1>
            <p class="mt-3 text-body text-ink-2">{m.reset_body()}</p>

            <form method="POST" action="?/request" class="mt-8 flex flex-col gap-4">
                {#if form?.error}
                    <p class={errorClass} role="alert">{form.error}</p>
                {/if}

                <div class="flex flex-col gap-1.5">
                    <label for="email" class={labelClass}>{m.auth_email()}</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autocomplete="email"
                        required
                        value={form?.email ?? ""}
                        class={inputClass}
                    />
                </div>

                <Button type="submit" fullWidth>{m.reset_submit()}</Button>
            </form>

            <p class="mt-6 text-small text-muted">
                <a
                    href={resolve("/sign-in")}
                    class="font-semibold text-brand underline underline-offset-4 hover:text-ink"
                >
                    {m.auth_to_sign_in()}
                </a>
            </p>
        {/if}
    </div>
</section>
