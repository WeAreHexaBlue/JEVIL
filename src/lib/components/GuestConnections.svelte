<script lang="ts">
    import { resolve } from "$app/paths";
    import { onMount } from "svelte";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import EmptyState from "#lib/components/EmptyState.svelte";
    import { errorClass, inputClass, labelClass } from "#lib/components/field-styles";
    import { decideLocal, LocalDecideError } from "#lib/connections/local";
    import { decideViaProxy, ProxyDecideError } from "#lib/connections/proxy";
    import {
        deleteGuestConnection,
        isGuestStoreAvailable,
        listGuestConnections,
        saveGuestConnection
    } from "#lib/connections/guest-store";
    import { buildBenchRequest, defaultBenchValues, type BenchValues } from "#lib/decide/bench";
    import type { DecideResponse } from "#lib/decide/types";
    import { makeGuestConnection, type GuestConnection } from "#lib/schema/guest";

    interface ProviderInfo {
        id: string;
        defaultBaseUrl: string;
        defaultModel: string | null;
        models: string[];
        capabilities: string[];
        requiresBaseUrl: boolean;
        requiresAccountId: boolean;
        allowsHeader: boolean;
    }

    let { providers }: { providers: ProviderInfo[] } = $props();

    const providerNames: Record<string, string> = {
        jev: "Jev",
        laya: "Laya",
        clef: "Clef",
        cloudflare: "Cloudflare Workers AI",
        systemone: "Local / custom"
    };

    const cloudProviders = $derived(providers.filter((provider) => provider.id !== "systemone"));

    let connections = $state<GuestConnection[]>([]);
    let loading = $state(true);
    let storageAvailable = $state(true);
    let storageError = $state<string | null>(null);
    let error = $state<string | null>(null);
    let added = $state<string | null>(null);
    let origin = $state("");

    let mode = $state<"cloud" | "local">("cloud");
    let provider = $state("laya");
    let label = $state("");
    let baseUrl = $state("");
    let model = $state("");
    let accountId = $state("");
    let secret = $state("");
    let headerName = $state("");

    let benchId = $state<string | null>(null);
    let benchState = $state(defaultBenchValues.state);
    let choiceInstructions = $state(defaultBenchValues.choiceInstructions);
    let choiceOptions = $state(defaultBenchValues.choiceOptions);
    let scoreInstructions = $state(defaultBenchValues.scoreInstructions);
    let scoreLevels = $state(defaultBenchValues.scoreLevels);
    let noulInstructions = $state(defaultBenchValues.noulInstructions);
    let running = $state(false);
    let result = $state<DecideResponse | null>(null);
    let latency = $state<number | null>(null);
    let runError = $state<string | null>(null);

    const selectedInfo = $derived(
        cloudProviders.find((item) => item.id === provider) ?? cloudProviders[0]
    );
    const effectiveProvider = $derived(mode === "local" ? "systemone" : provider);
    const benchValues = $derived<BenchValues>({
        state: benchState,
        choiceInstructions,
        choiceOptions,
        scoreInstructions,
        scoreLevels,
        noulInstructions
    });
    const tokens = $derived.by(() => {
        if (!result?.usage) return 0;
        if (result.usage.billed_tokens !== undefined) return result.usage.billed_tokens;
        return (result.usage.input_tokens ?? 0) + (result.usage.output_tokens ?? 0);
    });

    onMount(async () => {
        origin = window.location.origin;
        storageAvailable = isGuestStoreAvailable();

        try {
            connections = await listGuestConnections();
        } catch {
            storageError = m.connections_guest_storage();
        } finally {
            loading = false;
        }
    });

    function setMode(next: "cloud" | "local") {
        mode = next;
        error = null;
        added = null;
        baseUrl = "";
        model = "";
        accountId = "";
        headerName = "";
        provider = next === "local" ? "systemone" : "laya";
    }

    function chooseProvider(next: string) {
        provider = next;
        model = "";
        accountId = "";
    }

    async function add(event: SubmitEvent) {
        event.preventDefault();
        error = null;
        added = null;

        const connection = makeGuestConnection({
            mode,
            provider: effectiveProvider,
            label,
            baseUrl,
            model: model.trim() || undefined,
            secret: secret || undefined,
            accountId: accountId.trim() || undefined,
            headerName: headerName.trim() || undefined
        });

        if (!connection) {
            error = m.connections_guest_invalid();
            return;
        }

        try {
            await saveGuestConnection(connection);
            connections = await listGuestConnections();
            added = connection.label;
            label = "";
            baseUrl = "";
            model = "";
            accountId = "";
            secret = "";
            headerName = "";
        } catch {
            error = m.connections_guest_storage();
        }
    }

    async function remove(connection: GuestConnection) {
        if (!confirm(m.connections_guest_remove_confirm())) return;

        try {
            await deleteGuestConnection(connection.id);
            connections = await listGuestConnections();
            if (benchId === connection.id) closeBench();
        } catch {
            error = m.connections_guest_storage();
        }
    }

    function openBench(connection: GuestConnection) {
        benchId = connection.id;
        runError = null;
        result = null;
        latency = null;
    }

    function closeBench() {
        benchId = null;
        runError = null;
        result = null;
        latency = null;
    }

    async function run(connection: GuestConnection) {
        runError = null;
        result = null;
        latency = null;

        let request;
        try {
            request = buildBenchRequest(benchValues);
        } catch {
            runError = m.bench_invalid();
            return;
        }

        running = true;
        const started = performance.now();

        try {
            const response =
                connection.mode === "local"
                    ? await decideLocal(connection, request, { timeoutMs: 20_000 })
                    : await decideViaProxy(connection, request);

            latency = Math.round(performance.now() - started);
            result = response;
        } catch (failure) {
            const code =
                failure instanceof LocalDecideError || failure instanceof ProxyDecideError
                    ? failure.code
                    : "internal";
            runError =
                code === "unreachable" && connection.mode === "local"
                    ? m.connections_guest_cors_blocked()
                    : m.connections_guest_error({ code });
        } finally {
            running = false;
        }
    }

    const masked = (value?: string): string =>
        value && value.length > 0 ? `•••• ${value.slice(-4)}` : "";
</script>

<div class="flex flex-wrap items-end justify-between gap-4">
    <div>
        <h1 class="text-h1">{m.connections_guest_title()}</h1>
        <p class="mt-2 max-w-xl text-body text-ink-2">{m.connections_guest_sub()}</p>
    </div>
    <p class="font-mono text-micro text-muted" role="status">
        {m.connections_guest_count({ count: connections.length })}
    </p>
</div>

<div class="mt-6 rounded-md border border-line bg-paper-2/50 p-4">
    <p class="text-small text-ink-2">{m.connections_guest_sign_in_hint()}</p>
    <a
        href={resolve("/sign-in?next=%2Fsettings%2Fconnections")}
        class="mt-1 inline-block text-small font-semibold text-brand underline underline-offset-4 hover:text-ink"
    >
        {m.connections_guest_sign_in()}
    </a>
</div>

{#if storageError}
    <p class="{errorClass} mt-6" role="alert">{storageError}</p>
{/if}

{#if added}
    <p class="mt-6 rounded-sm bg-brand-soft px-4 py-3 text-small text-ink" role="status">
        {m.connections_notice_created()}
    </p>
{/if}

<div class="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
    <div class="flex flex-col gap-4">
        {#if loading}
            <p class="text-small text-muted" role="status">
                {m.connections_guest_count({ count: 0 })}
            </p>
        {:else if connections.length === 0}
            <div class="rounded-lg border border-dashed border-line bg-paper-2/40 p-8">
                <EmptyState
                    title={m.connections_guest_empty_title()}
                    body={m.connections_guest_empty_body()}
                />
            </div>
        {/if}

        {#each connections as connection (connection.id)}
            <article class="rounded-lg border border-line bg-paper p-5 shadow-soft">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-h3">{connection.label}</h2>
                        <p class="mt-0.5 text-small text-muted">
                            {providerNames[connection.provider] ?? connection.provider}
                            {#if connection.mode === "local"}
                                · {m.connections_guest_local()}
                            {/if}
                            {#if connection.model}
                                · <span class="font-mono text-micro">{connection.model}</span>
                            {/if}
                        </p>
                    </div>
                    <span
                        class="rounded-full bg-paper-3 px-2.5 py-1 font-mono text-micro font-semibold text-muted uppercase"
                    >
                        {m.connections_guest_title()}
                    </span>
                </div>

                <dl class="mt-4 grid gap-2 text-small sm:grid-cols-2">
                    {#if connection.baseUrl}
                        <div>
                            <dt class="text-micro text-muted">URL</dt>
                            <dd class="font-mono text-micro break-all">{connection.baseUrl}</dd>
                        </div>
                    {/if}
                    {#if connection.accountId}
                        <div>
                            <dt class="text-micro text-muted">{m.connections_account_id()}</dt>
                            <dd class="font-mono text-micro break-all">{connection.accountId}</dd>
                        </div>
                    {/if}
                    {#if connection.secret}
                        <div>
                            <dt class="text-micro text-muted">{m.connections_guest_key()}</dt>
                            <dd class="font-mono text-micro">{masked(connection.secret)}</dd>
                        </div>
                    {/if}
                </dl>

                <div class="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                        variant="secondary"
                        onclick={() =>
                            benchId === connection.id ? closeBench() : openBench(connection)}
                    >
                        {benchId === connection.id
                            ? m.connections_guest_close_bench()
                            : m.connections_guest_bench()}
                    </Button>
                    <Button variant="ghost" onclick={() => remove(connection)}>
                        {m.connections_guest_remove()}
                    </Button>
                </div>

                {#if connection.mode === "local"}
                    <details class="mt-4 border-t border-line pt-4">
                        <summary class="cursor-pointer text-small font-semibold text-ink">
                            {m.connections_guest_cors_title()}
                        </summary>
                        <p class="mt-2 text-small text-ink-2">{m.connections_guest_cors_body()}</p>
                        <pre
                            class="mt-2 overflow-auto rounded-sm bg-night p-3 font-mono text-micro whitespace-pre-wrap text-on-night">{`Access-Control-Allow-Origin: ${origin || "http://localhost:5173"}
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Allow-Methods: GET, POST, OPTIONS`}</pre>
                        <p class="mt-3 text-small text-ink-2">
                            {m.connections_guest_cors_check()}
                        </p>
                        <pre
                            class="mt-2 overflow-auto rounded-sm bg-night p-3 font-mono text-micro whitespace-pre-wrap text-on-night">{`curl -i ${connection.baseUrl.replace(/\/+$/, "")}/health`}</pre>
                    </details>
                {/if}

                {#if benchId === connection.id}
                    <div class="mt-4 border-t border-line pt-4">
                        <p class="text-small text-ink-2">{m.connections_guest_bench_hint()}</p>

                        {#if runError}
                            <p class="{errorClass} mt-3" role="alert">{runError}</p>
                        {/if}

                        <form
                            class="mt-4 flex flex-col gap-4"
                            onsubmit={(event) => {
                                event.preventDefault();
                                void run(connection);
                            }}
                        >
                            <div class="flex flex-col gap-1.5">
                                <label for="guest-state" class={labelClass}>{m.bench_state()}</label
                                >
                                <textarea
                                    id="guest-state"
                                    rows="3"
                                    required
                                    bind:value={benchState}
                                    class="{inputClass} h-auto py-3"
                                    placeholder="a moody forest at dusk"></textarea>
                                <p class="text-micro text-muted">{m.bench_state_hint()}</p>
                            </div>

                            <fieldset class="rounded-md border border-line p-4">
                                <legend class="px-1 text-small font-semibold">
                                    {m.bench_choice()}
                                </legend>
                                <label
                                    for="guest-choice-instructions"
                                    class="{labelClass} mt-2 block">{m.bench_instructions()}</label
                                >
                                <input
                                    id="guest-choice-instructions"
                                    bind:value={choiceInstructions}
                                    class="{inputClass} mt-1.5"
                                />
                                <label for="guest-choice-options" class="{labelClass} mt-3 block"
                                    >{m.bench_options()}</label
                                >
                                <textarea
                                    id="guest-choice-options"
                                    rows="2"
                                    bind:value={choiceOptions}
                                    class="{inputClass} mt-1.5 h-auto py-2"></textarea>
                                <p class="mt-1 text-micro text-muted">{m.bench_choice_hint()}</p>
                            </fieldset>

                            <fieldset class="rounded-md border border-line p-4">
                                <legend class="px-1 text-small font-semibold">
                                    {m.bench_score()}
                                </legend>
                                <label
                                    for="guest-score-instructions"
                                    class="{labelClass} mt-2 block">{m.bench_instructions()}</label
                                >
                                <input
                                    id="guest-score-instructions"
                                    bind:value={scoreInstructions}
                                    class="{inputClass} mt-1.5"
                                />
                                <label for="guest-score-levels" class="{labelClass} mt-3 block"
                                    >{m.bench_levels()}</label
                                >
                                <textarea
                                    id="guest-score-levels"
                                    rows="2"
                                    bind:value={scoreLevels}
                                    class="{inputClass} mt-1.5 h-auto py-2"></textarea>
                                <p class="mt-1 text-micro text-muted">{m.bench_score_hint()}</p>
                            </fieldset>

                            <div class="flex flex-col gap-1.5">
                                <label for="guest-noul" class={labelClass}>{m.bench_noul()}</label>
                                <input
                                    id="guest-noul"
                                    bind:value={noulInstructions}
                                    class={inputClass}
                                />
                                <p class="text-micro text-muted">{m.bench_noul_hint()}</p>
                            </div>

                            <div>
                                <Button type="submit" disabled={running}>
                                    {running ? "…" : m.connections_guest_run()}
                                </Button>
                            </div>
                        </form>

                        <div class="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                            <h3 class="text-small font-semibold">{m.bench_result()}</h3>
                            {#if latency !== null}
                                <p class="font-mono text-micro text-muted">
                                    {m.connections_guest_bench_latency({ ms: String(latency) })}
                                    {#if tokens > 0}
                                        · {m.bench_tokens({ tokens: String(tokens) })}
                                    {/if}
                                </p>
                            {/if}
                        </div>

                        {#if result}
                            <pre
                                class="mt-2 max-h-96 overflow-auto rounded-sm bg-night p-3 font-mono text-micro whitespace-pre-wrap text-on-night">{JSON.stringify(
                                    result,
                                    null,
                                    2
                                )}</pre>
                        {:else}
                            <p class="mt-2 text-small text-muted">{m.bench_empty()}</p>
                        {/if}
                    </div>
                {/if}
            </article>
        {/each}
    </div>

    <aside class="rounded-lg border border-line bg-paper p-5 shadow-soft lg:sticky lg:top-24">
        <h2 class="text-h2">{m.connections_add_title()}</h2>

        {#if error}
            <p class="{errorClass} mt-4" role="alert">{error}</p>
        {/if}

        <form class="mt-5 flex flex-col gap-4" onsubmit={add}>
            <fieldset>
                <legend class={labelClass}>{m.connections_guest_mode()}</legend>
                <div class="mt-2 flex flex-wrap gap-2">
                    <label
                        class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-small font-medium"
                    >
                        <input
                            type="radio"
                            name="mode"
                            value="cloud"
                            checked={mode === "cloud"}
                            onchange={() => setMode("cloud")}
                        />
                        {m.connections_guest_cloud()}
                    </label>
                    <label
                        class="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-small font-medium"
                    >
                        <input
                            type="radio"
                            name="mode"
                            value="local"
                            checked={mode === "local"}
                            onchange={() => setMode("local")}
                        />
                        {m.connections_guest_local()}
                    </label>
                </div>
            </fieldset>

            {#if mode === "cloud"}
                <div class="flex flex-col gap-1.5">
                    <label for="guest-provider" class={labelClass}>{m.connections_provider()}</label
                    >
                    <select
                        id="guest-provider"
                        value={provider}
                        onchange={(event) => chooseProvider(event.currentTarget.value)}
                        class={inputClass}
                    >
                        {#each cloudProviders as item (item.id)}
                            <option value={item.id}>{providerNames[item.id] ?? item.id}</option>
                        {/each}
                    </select>
                </div>
            {:else}
                <p class="rounded-sm bg-brand-soft px-3 py-2 text-small text-ink">
                    {m.connections_guest_local_note()}
                </p>
            {/if}

            <div class="flex flex-col gap-1.5">
                <label for="guest-label" class={labelClass}>{m.connections_label()}</label>
                <input
                    id="guest-label"
                    bind:value={label}
                    required
                    maxlength="60"
                    autocomplete="off"
                    class={inputClass}
                    placeholder="Personal Laya"
                />
            </div>

            <div class="flex flex-col gap-1.5">
                <label for="guest-base-url" class={labelClass}>{m.connections_base_url()}</label>
                <input
                    id="guest-base-url"
                    bind:value={baseUrl}
                    type="url"
                    inputmode="url"
                    autocomplete="off"
                    required={mode === "local"}
                    placeholder={mode === "local"
                        ? "http://127.0.0.1:8098"
                        : (selectedInfo?.defaultBaseUrl ?? "")}
                    class={inputClass}
                />
                <p class="text-micro text-muted">
                    {mode === "local"
                        ? m.connections_guest_local_hint()
                        : m.connections_base_url_hint()}
                </p>
            </div>

            <div class="flex flex-col gap-1.5">
                <label for="guest-model" class={labelClass}>{m.connections_model()}</label>
                {#if mode === "cloud" && selectedInfo && selectedInfo.models.length > 0}
                    <select id="guest-model" bind:value={model} class={inputClass}>
                        <option value="">{m.connections_model_default()}</option>
                        {#each selectedInfo.models as item (item)}
                            <option value={item}>{item}</option>
                        {/each}
                    </select>
                {:else}
                    <input
                        id="guest-model"
                        bind:value={model}
                        autocomplete="off"
                        spellcheck="false"
                        class={inputClass}
                    />
                {/if}
                <p class="text-micro text-muted">{m.connections_model_hint()}</p>
            </div>

            {#if mode === "cloud" && selectedInfo?.requiresAccountId}
                <div class="flex flex-col gap-1.5">
                    <label for="guest-account" class={labelClass}>
                        {m.connections_account_id()}
                    </label>
                    <input
                        id="guest-account"
                        bind:value={accountId}
                        required
                        autocomplete="off"
                        spellcheck="false"
                        class={inputClass}
                    />
                    <p class="text-micro text-muted">{m.connections_account_id_hint()}</p>
                </div>
            {/if}

            <div class="flex flex-col gap-1.5">
                <label for="guest-secret" class={labelClass}>
                    {mode === "local"
                        ? m.connections_guest_key_optional()
                        : m.connections_guest_key()}
                </label>
                <input
                    id="guest-secret"
                    bind:value={secret}
                    type="password"
                    autocomplete="off"
                    spellcheck="false"
                    maxlength="4096"
                    required={mode === "cloud"}
                    class={inputClass}
                    placeholder={m.connections_secret_placeholder()}
                />
                <p class="text-micro text-muted">{m.connections_guest_key_hint()}</p>
            </div>

            {#if mode === "local"}
                <div class="flex flex-col gap-1.5">
                    <label for="guest-header" class={labelClass}>
                        {m.connections_header_name()}
                    </label>
                    <input
                        id="guest-header"
                        bind:value={headerName}
                        autocomplete="off"
                        spellcheck="false"
                        class={inputClass}
                    />
                    <p class="text-micro text-muted">{m.connections_header_name_hint()}</p>
                </div>
            {/if}

            <div>
                <Button type="submit" disabled={!storageAvailable}>
                    {m.connections_add_submit()}
                </Button>
            </div>
        </form>
    </aside>
</div>
