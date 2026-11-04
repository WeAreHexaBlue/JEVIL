<script lang="ts">
    import { untrack } from "svelte";
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import EmptyState from "#lib/components/EmptyState.svelte";
    import GuestConnections from "#lib/components/GuestConnections.svelte";
    import GuestImport from "#lib/components/GuestImport.svelte";
    import { errorClass, inputClass, labelClass } from "#lib/components/field-styles";
    import type { PageProps } from "./$types";

    let { data, form }: PageProps = $props();

    const providerNames: Record<string, string> = {
        jev: "Jev",
        laya: "Laya",
        clef: "Clef",
        cloudflare: "Cloudflare Workers AI",
        systemone: "Local / custom"
    };

    const createValues = $derived.by(() => {
        if (form?.action !== "create") return undefined;
        if (!("values" in form) || !form.values) return undefined;
        return "provider" in form.values ? form.values : undefined;
    });

    let selected = $state(untrack(() => createValues?.provider ?? data.providers[0]?.id ?? "jev"));
    const selectedInfo = $derived(
        data.providers.find((p) => p.id === selected) ?? data.providers[0]
    );

    const notice = $derived(
        data.notice === "created"
            ? m.connections_notice_created()
            : data.notice === "saved"
              ? m.connections_notice_saved()
              : data.notice === "deleted"
                ? m.connections_notice_deleted()
                : null
    );

    const globalError = $derived(
        form?.action === "create" || form?.action === "delete" ? form.error : null
    );

    const statusLabel = (status: string): string =>
        status === "ok"
            ? m.connections_status_ok()
            : status === "error"
              ? m.connections_status_error()
              : m.connections_status_unchecked();

    const statusClass = (status: string): string =>
        status === "ok"
            ? "bg-green/15 text-green"
            : status === "error"
              ? "bg-red/10 text-red"
              : "bg-paper-3 text-muted";
</script>

<svelte:head>
    <title>{m.connections_title()} — JEVIL</title>
    <meta name="description" content={m.connections_sub()} />
</svelte:head>

<section class="container-page py-12 md:py-16">
    {#if data.guest}
        <GuestConnections providers={data.providers} />
    {:else}
        <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 class="text-h1">{m.connections_title()}</h1>
                <p class="mt-2 max-w-xl text-body text-ink-2">{m.connections_sub()}</p>
            </div>
            <p class="font-mono text-micro text-muted" role="status">
                {m.connections_count({ count: data.connections.length })}
            </p>
        </div>

        <GuestImport />

        {#if notice}
            <p class="mt-6 rounded-sm bg-brand-soft px-4 py-3 text-small text-ink" role="status">
                {notice}
            </p>
        {/if}

        {#if globalError}
            <p class="{errorClass} mt-6" role="alert">{globalError}</p>
        {/if}

        <div class="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
            <div class="flex flex-col gap-4">
                {#if data.connections.length === 0}
                    <div class="rounded-lg border border-dashed border-line bg-paper-2/40 p-8">
                        <EmptyState
                            title={m.connections_empty_title()}
                            body={m.connections_empty_body()}
                        />
                    </div>
                {/if}

                {#each data.connections as connection (connection.id)}
                    <article class="rounded-lg border border-line bg-paper p-5 shadow-soft">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 class="text-h3">{connection.label}</h2>
                                <p class="mt-0.5 text-small text-muted">
                                    {providerNames[connection.provider] ?? connection.provider}
                                    {#if connection.model}
                                        · <span class="font-mono text-micro"
                                            >{connection.model}</span
                                        >
                                    {/if}
                                </p>
                            </div>
                            <span
                                class="rounded-full px-2.5 py-1 font-mono text-micro font-semibold uppercase {statusClass(
                                    connection.status
                                )}"
                            >
                                {statusLabel(connection.status)}
                            </span>
                        </div>

                        <dl class="mt-4 grid gap-2 text-small sm:grid-cols-2">
                            {#if connection.baseUrl}
                                <div>
                                    <dt class="text-micro text-muted">URL</dt>
                                    <dd class="font-mono text-micro break-all">
                                        {connection.baseUrl}
                                    </dd>
                                </div>
                            {/if}
                            {#if connection.config.accountId}
                                <div>
                                    <dt class="text-micro text-muted">Account</dt>
                                    <dd class="font-mono text-micro break-all">
                                        {connection.config.accountId}
                                    </dd>
                                </div>
                            {/if}
                            {#if connection.secretLast4}
                                <div>
                                    <dt class="text-micro text-muted">{m.connections_secret()}</dt>
                                    <dd class="font-mono text-micro">
                                        {m.connections_key_masked({
                                            last4: connection.secretLast4
                                        })}
                                    </dd>
                                </div>
                            {/if}
                            <div>
                                <dt class="text-micro text-muted">Auth</dt>
                                <dd class="font-mono text-micro">{connection.authScheme}</dd>
                            </div>
                        </dl>

                        <div class="mt-4 flex flex-wrap items-center gap-2">
                            <form method="POST" action="?/test">
                                <input type="hidden" name="id" value={connection.id} />
                                <Button type="submit" variant="secondary"
                                    >{m.connections_test()}</Button
                                >
                            </form>

                            <Button
                                href={resolve("/settings/connections/[id]/test", {
                                    id: connection.id
                                })}
                                variant="ghost"
                            >
                                {m.bench_open()}
                            </Button>

                            <details class="group">
                                <summary
                                    class="inline-flex min-h-11 cursor-pointer list-none items-center rounded-full px-5 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-paper-2"
                                >
                                    {m.connections_edit()}
                                </summary>
                                <div class="mt-4 rounded-md border border-line bg-paper-2/50 p-4">
                                    <h3 class="text-h3">
                                        {m.connections_edit_title({ label: connection.label })}
                                    </h3>

                                    {#if form?.action === "update" && form.id === connection.id && form.error}
                                        <p class="{errorClass} mt-3" role="alert">{form.error}</p>
                                    {/if}

                                    <form
                                        method="POST"
                                        action="?/update"
                                        class="mt-4 flex flex-col gap-4"
                                    >
                                        <input type="hidden" name="id" value={connection.id} />

                                        <div class="flex flex-col gap-1.5">
                                            <label for="label-{connection.id}" class={labelClass}>
                                                {m.connections_label()}
                                            </label>
                                            <input
                                                id="label-{connection.id}"
                                                name="label"
                                                required
                                                maxlength="60"
                                                value={form?.action === "update" &&
                                                form.id === connection.id
                                                    ? form.values?.label
                                                    : connection.label}
                                                class={inputClass}
                                            />
                                        </div>

                                        <div class="flex flex-col gap-1.5">
                                            <label for="base-{connection.id}" class={labelClass}>
                                                {m.connections_base_url()}
                                            </label>
                                            <input
                                                id="base-{connection.id}"
                                                name="baseUrl"
                                                type="url"
                                                inputmode="url"
                                                autocomplete="off"
                                                required={connection.provider === "systemone"}
                                                value={form?.action === "update" &&
                                                form.id === connection.id
                                                    ? form.values?.baseUrl
                                                    : connection.baseUrl}
                                                class={inputClass}
                                            />
                                            <p class="text-micro text-muted">
                                                {m.connections_base_url_hint()}
                                            </p>
                                        </div>

                                        <div class="flex flex-col gap-1.5">
                                            <label for="model-{connection.id}" class={labelClass}>
                                                {m.connections_model()}
                                            </label>
                                            <input
                                                id="model-{connection.id}"
                                                name="model"
                                                list="models-{connection.provider}"
                                                autocomplete="off"
                                                spellcheck="false"
                                                value={form?.action === "update" &&
                                                form.id === connection.id
                                                    ? form.values?.model
                                                    : (connection.model ?? "")}
                                                class={inputClass}
                                            />
                                        </div>

                                        {#if connection.provider === "cloudflare"}
                                            <div class="flex flex-col gap-1.5">
                                                <label
                                                    for="account-{connection.id}"
                                                    class={labelClass}
                                                >
                                                    {m.connections_account_id()}
                                                </label>
                                                <input
                                                    id="account-{connection.id}"
                                                    name="accountId"
                                                    required
                                                    autocomplete="off"
                                                    spellcheck="false"
                                                    value={form?.action === "update" &&
                                                    form.id === connection.id
                                                        ? form.values?.accountId
                                                        : (connection.config.accountId ?? "")}
                                                    class={inputClass}
                                                />
                                            </div>
                                        {/if}

                                        {#if connection.provider === "systemone"}
                                            <div class="flex flex-col gap-1.5">
                                                <label
                                                    for="header-{connection.id}"
                                                    class={labelClass}
                                                >
                                                    {m.connections_header_name()}
                                                </label>
                                                <input
                                                    id="header-{connection.id}"
                                                    name="headerName"
                                                    autocomplete="off"
                                                    spellcheck="false"
                                                    value={form?.action === "update" &&
                                                    form.id === connection.id
                                                        ? form.values?.headerName
                                                        : (connection.config.headerName ?? "")}
                                                    class={inputClass}
                                                />
                                                <p class="text-micro text-muted">
                                                    {m.connections_header_name_hint()}
                                                </p>
                                            </div>
                                        {/if}

                                        <div class="flex flex-col gap-1.5">
                                            <label for="secret-{connection.id}" class={labelClass}>
                                                {m.connections_secret()}
                                            </label>
                                            <input
                                                id="secret-{connection.id}"
                                                name="secret"
                                                type="password"
                                                autocomplete="new-password"
                                                spellcheck="false"
                                                maxlength="4096"
                                                placeholder={m.connections_secret_keep()}
                                                class={inputClass}
                                            />
                                            <p class="text-micro text-muted">
                                                {m.connections_secret_hint()}
                                            </p>
                                        </div>

                                        <div class="flex flex-wrap gap-2">
                                            <Button type="submit">{m.connections_save()}</Button>
                                        </div>
                                    </form>

                                    <form
                                        method="POST"
                                        action="?/delete"
                                        class="mt-4 border-t border-line pt-4"
                                        onsubmit={(event) => {
                                            if (!confirm(m.connections_delete_confirm())) {
                                                event.preventDefault();
                                            }
                                        }}
                                    >
                                        <input type="hidden" name="id" value={connection.id} />
                                        <Button type="submit" variant="danger">
                                            {m.connections_delete()}
                                        </Button>
                                    </form>
                                </div>
                            </details>

                            {#if form?.action === "test" && form.id === connection.id}
                                {#if form.tested}
                                    <p class="text-small font-semibold text-green" role="status">
                                        {m.connections_test_ok()}
                                    </p>
                                {:else}
                                    <p class="text-small font-semibold text-red" role="alert">
                                        {m.connections_test_error({ code: form.code ?? "unknown" })}
                                    </p>
                                {/if}
                            {/if}
                        </div>
                    </article>
                {/each}
            </div>

            <aside
                class="rounded-lg border border-line bg-paper p-5 shadow-soft lg:sticky lg:top-24"
            >
                <h2 class="text-h2">{m.connections_add_title()}</h2>

                {#if form?.action === "create" && form.error}
                    <p class="{errorClass} mt-4" role="alert">{form.error}</p>
                {/if}

                <form method="POST" action="?/create" class="mt-5 flex flex-col gap-4">
                    <div class="flex flex-col gap-1.5">
                        <label for="provider" class={labelClass}>{m.connections_provider()}</label>
                        <select
                            id="provider"
                            name="provider"
                            bind:value={selected}
                            class={inputClass}
                        >
                            {#each data.providers as provider (provider.id)}
                                <option value={provider.id}>
                                    {providerNames[provider.id] ?? provider.id}
                                </option>
                            {/each}
                        </select>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="label" class={labelClass}>{m.connections_label()}</label>
                        <input
                            id="label"
                            name="label"
                            required
                            maxlength="60"
                            autocomplete="off"
                            value={createValues?.label ?? ""}
                            class={inputClass}
                        />
                        <p class="text-micro text-muted">{m.connections_label_hint()}</p>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="baseUrl" class={labelClass}>{m.connections_base_url()}</label>
                        <input
                            id="baseUrl"
                            name="baseUrl"
                            type="url"
                            inputmode="url"
                            autocomplete="off"
                            required={selectedInfo.requiresBaseUrl}
                            placeholder={selectedInfo.defaultBaseUrl || "http://localhost:8000"}
                            value={createValues?.baseUrl ?? ""}
                            class={inputClass}
                        />
                        <p class="text-micro text-muted">
                            {selectedInfo.requiresBaseUrl
                                ? m.connections_base_url_required()
                                : m.connections_base_url_hint()}
                        </p>
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="model" class={labelClass}>{m.connections_model()}</label>
                        {#if selectedInfo.models.length > 0}
                            <select id="model" name="model" class={inputClass}>
                                <option value="">{m.connections_model_default()}</option>
                                {#each selectedInfo.models as model (model)}
                                    <option value={model}>{model}</option>
                                {/each}
                            </select>
                        {:else}
                            <input
                                id="model"
                                name="model"
                                autocomplete="off"
                                spellcheck="false"
                                value={createValues?.model ?? ""}
                                class={inputClass}
                            />
                        {/if}
                        <p class="text-micro text-muted">{m.connections_model_hint()}</p>
                    </div>

                    {#if selectedInfo.requiresAccountId}
                        <div class="flex flex-col gap-1.5">
                            <label for="accountId" class={labelClass}>
                                {m.connections_account_id()}
                            </label>
                            <input
                                id="accountId"
                                name="accountId"
                                required
                                autocomplete="off"
                                spellcheck="false"
                                value={createValues?.accountId ?? ""}
                                class={inputClass}
                            />
                            <p class="text-micro text-muted">{m.connections_account_id_hint()}</p>
                        </div>
                    {/if}

                    {#if selectedInfo.allowsHeader}
                        <div class="flex flex-col gap-1.5">
                            <label for="headerName" class={labelClass}>
                                {m.connections_header_name()}
                            </label>
                            <input
                                id="headerName"
                                name="headerName"
                                autocomplete="off"
                                spellcheck="false"
                                value={createValues?.headerName ?? ""}
                                class={inputClass}
                            />
                            <p class="text-micro text-muted">{m.connections_header_name_hint()}</p>
                        </div>
                    {/if}

                    <div class="flex flex-col gap-1.5">
                        <label for="secret" class={labelClass}>{m.connections_secret()}</label>
                        <input
                            id="secret"
                            name="secret"
                            type="password"
                            autocomplete="new-password"
                            spellcheck="false"
                            maxlength="4096"
                            required={selected !== "systemone"}
                            placeholder={m.connections_secret_placeholder()}
                            class={inputClass}
                        />
                        <p class="text-micro text-muted">{m.connections_secret_hint()}</p>
                    </div>

                    <Button type="submit" fullWidth>{m.connections_add_submit()}</Button>

                    {#if selectedInfo.capabilities.includes("text")}
                        <p class="text-micro text-muted">
                            {m.connections_capabilities({
                                list: selectedInfo.capabilities.join(", ")
                            })}
                        </p>
                    {/if}
                </form>

                <p class="mt-5 border-t border-line pt-4 text-micro text-muted">
                    {m.connections_local_note()}
                </p>
            </aside>
        </div>

        {#each data.providers as provider (provider.id)}
            {#if provider.models.length > 0}
                <datalist id="models-{provider.id}">
                    {#each provider.models as model (model)}
                        <option value={model}></option>
                    {/each}
                </datalist>
            {/if}
        {/each}
    {/if}
</section>
