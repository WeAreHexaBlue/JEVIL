<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { m } from "#lib/paraglide/messages";
    import { inputClass, labelClass } from "#lib/components/field-styles";
    import Button from "#lib/components/Button.svelte";
    import type { Answer } from "#lib/decide/types";
    import { listGuestConnections } from "#lib/connections/guest-store";
    import { providerName } from "#lib/connections/labels";
    import { accountTransport, guestTransport } from "#lib/connections/transport";
    import type { Blueprint } from "#lib/schema/blueprint";
    import type { ConnectionView } from "#lib/schema/connection";
    import type { GuestConnection } from "#lib/schema/guest";
    import type { InputValue } from "#lib/runtime/bindings";
    import { createRunner, type BlueprintRunner, type RuntimeSnapshot } from "#lib/runtime/runner";

    let {
        blueprint,
        connections,
        onuseanswers
    }: {
        blueprint: Blueprint | null;
        connections: ConnectionView[];
        onuseanswers: (answers: Record<string, Record<string, Answer>>) => void;
    } = $props();

    let runner = $state<BlueprintRunner | null>(null);
    let snapshot = $state<RuntimeSnapshot | null>(null);
    let inputs = $state<Record<string, InputValue>>({});
    let guests = $state<GuestConnection[]>([]);
    let selection = $state(untrack(() => (connections[0] ? `account:${connections[0].id}` : "")));
    let showJson = $state(false);

    $effect(() => {
        const current = blueprint ? createRunner({ blueprint, preview: false }) : null;
        runner = current;
        snapshot = current?.getSnapshot() ?? null;
        inputs = current?.inputValues ?? {};
    });

    $effect(() => {
        const current = runner;
        if (!current) return;

        const stop = current.subscribe((next) => {
            snapshot = next;
            inputs = current.inputValues;
        });
        snapshot = current.getSnapshot();
        inputs = current.inputValues;

        return stop;
    });

    $effect(() => {
        const current = runner;
        if (!current) return;

        if (!selection) {
            current.setTransport(undefined);
            return;
        }

        if (selection.startsWith("account:")) {
            current.setTransport(accountTransport(selection.slice("account:".length)));
            return;
        }

        const guest = guests.find((item) => `guest:${item.id}` === selection);
        current.setTransport(guest ? guestTransport(guest) : undefined);
    });

    onMount(() => {
        void (async () => {
            try {
                guests = await listGuestConnections();
                if (!selection && guests[0]) selection = `guest:${guests[0].id}`;
            } catch {
                guests = [];
            }
        })();
    });

    const statusTone: Record<string, string> = {
        pending: "border-line bg-paper-2 text-muted",
        running: "border-brand/40 bg-brand-soft text-brand",
        done: "border-lime/50 bg-lime/20 text-ink",
        skipped: "border-line bg-paper-2 text-muted",
        error: "border-red/40 bg-red/10 text-red"
    };

    const run = (): void => {
        if (!runner) return;
        void runner.run();
    };

    const setInput = (id: string, value: unknown): void => {
        runner?.setInput(id, value);
    };

    const answers = $derived(snapshot?.answers ?? {});
    const hasAnswers = $derived(Object.keys(answers).length > 0);
</script>

<section class="flex flex-col gap-4 rounded-md border border-line bg-paper-2/60 p-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
        <h2 class="text-h4">{m.editor_test_bench()}</h2>
        <div class="flex flex-wrap items-center gap-2">
            <label class="flex items-center gap-2 text-micro text-muted">
                {m.editor_connection()}
                <select
                    class="h-9 min-w-44 rounded-sm border border-line bg-paper px-2 text-small text-ink focus:border-brand focus:outline-none"
                    bind:value={selection}
                >
                    {#if connections.length === 0 && guests.length === 0}
                        <option value="">{m.editor_no_connection()}</option>
                    {/if}
                    {#if connections.length > 0}
                        <optgroup label={m.app_detail_connection_saved()}>
                            {#each connections as connection (connection.id)}
                                <option value={`account:${connection.id}`}>
                                    {connection.label} · {providerName(connection.provider)}
                                </option>
                            {/each}
                        </optgroup>
                    {/if}
                    {#if guests.length > 0}
                        <optgroup label={m.app_detail_connection_browser()}>
                            {#each guests as guest (guest.id)}
                                <option value={`guest:${guest.id}`}>
                                    {guest.label} · {providerName(guest.provider)}
                                </option>
                            {/each}
                        </optgroup>
                    {/if}
                </select>
            </label>
            <Button
                onclick={run}
                loading={snapshot?.status === "running"}
                disabled={!runner || !selection || snapshot?.status === "running"}
            >
                {snapshot?.status === "running" ? m.editor_running() : m.editor_run()}
            </Button>
        </div>
    </div>

    {#if !blueprint}
        <p class="text-small text-muted">Fix the validation issues before running the draft.</p>
    {:else}
        {#if blueprint.inputs.length > 0}
            <div class="grid gap-3 sm:grid-cols-2">
                {#each blueprint.inputs as input (input.id)}
                    <label class="flex flex-col gap-1.5">
                        <span class={labelClass}>{input.label}</span>

                        {#if input.type === "textarea"}
                            <textarea
                                class="min-h-20 w-full rounded-sm border-[1.5px] border-line bg-paper-2 px-3 py-2 text-small text-ink focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none"
                                value={String(inputs[input.id] ?? "")}
                                placeholder={input.placeholder}
                                maxlength={input.maxLength}
                                oninput={(event) => setInput(input.id, event.currentTarget.value)}
                            ></textarea>
                        {:else if input.type === "select"}
                            <select
                                class={inputClass}
                                value={String(inputs[input.id] ?? "")}
                                onchange={(event) => setInput(input.id, event.currentTarget.value)}
                            >
                                {#if input.placeholder}
                                    <option value="">{input.placeholder}</option>
                                {/if}
                                {#each input.options ?? [] as option (option.value)}
                                    <option value={option.value}>{option.label}</option>
                                {/each}
                            </select>
                        {:else if input.type === "toggle"}
                            <span class="flex items-center gap-2 text-small text-ink-2">
                                <input
                                    type="checkbox"
                                    class="size-4 accent-brand"
                                    checked={inputs[input.id] === true}
                                    onchange={(event) =>
                                        setInput(input.id, event.currentTarget.checked)}
                                />
                                {inputs[input.id] === true ? "true" : "false"}
                            </span>
                        {:else if input.type === "slider"}
                            <span class="flex items-center gap-3">
                                <input
                                    class="w-full accent-brand"
                                    type="range"
                                    value={Number(inputs[input.id] ?? input.min ?? 0)}
                                    min={input.min}
                                    max={input.max}
                                    step={input.step}
                                    oninput={(event) =>
                                        setInput(input.id, Number(event.currentTarget.value))}
                                />
                                <span
                                    class="w-12 shrink-0 text-right font-mono text-micro text-muted"
                                >
                                    {Number(inputs[input.id] ?? input.min ?? 0)}
                                </span>
                            </span>
                        {:else}
                            <input
                                class={inputClass}
                                type={input.type === "color" ? "color" : "text"}
                                value={String(inputs[input.id] ?? "")}
                                placeholder={input.placeholder}
                                maxlength={input.maxLength}
                                oninput={(event) => setInput(input.id, event.currentTarget.value)}
                            />
                        {/if}

                        {#if input.help}
                            <span class="text-micro text-muted">{input.help}</span>
                        {/if}
                    </label>
                {/each}
            </div>
        {/if}

        <div class="flex flex-wrap items-center gap-2">
            {#each snapshot?.steps ?? [] as step (step.id)}
                <span
                    class="rounded-full border px-2.5 py-0.5 text-micro font-semibold {statusTone[
                        step.status
                    ] ?? statusTone.pending}"
                >
                    {step.label ?? step.id} · {step.status}
                </span>
            {/each}
            {#if snapshot?.durationMs !== undefined}
                <span class="font-mono text-micro text-muted">
                    {m.editor_latency({ ms: Math.round(snapshot.durationMs) })}
                </span>
            {/if}
        </div>

        {#if snapshot?.error}
            <p
                class="rounded-sm border border-red/40 bg-red/10 px-3 py-2 text-small text-ink"
                role="alert"
            >
                {snapshot.error.message}
            </p>
        {/if}

        {#if snapshot?.warnings && snapshot.warnings.length > 0}
            <ul class="flex flex-col gap-1">
                {#each snapshot.warnings as warning, index (index)}
                    <li class="font-mono text-micro text-gold">{warning}</li>
                {/each}
            </ul>
        {/if}

        {#if hasAnswers}
            <div class="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    class="text-micro text-muted underline-offset-2 hover:text-ink hover:underline"
                    onclick={() => (showJson = !showJson)}
                >
                    {m.editor_answers()} · {showJson ? "hide JSON" : "show JSON"}
                </button>
                <Button
                    variant="secondary"
                    class="min-h-9 px-3 text-[0.8125rem]"
                    onclick={() => onuseanswers(answers)}
                >
                    {m.editor_use_sample()}
                </Button>
            </div>

            {#if showJson}
                <pre
                    class="max-h-64 overflow-auto rounded-sm border border-line bg-night p-3 font-mono text-micro text-on-night"><code
                        >{JSON.stringify(answers, null, 2)}</code
                    ></pre>
            {/if}
        {/if}
    {/if}
</section>
