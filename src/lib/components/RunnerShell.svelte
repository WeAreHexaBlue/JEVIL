<script lang="ts">
    import { onMount, untrack } from "svelte";
    import { resolve } from "$app/paths";
    import { m } from "#lib/paraglide/messages";
    import Button from "#lib/components/Button.svelte";
    import { inputClass, labelClass } from "#lib/components/field-styles";
    import type { Answer } from "#lib/decide/types";
    import { decideViaAccount } from "#lib/connections/account";
    import { listGuestConnections } from "#lib/connections/guest-store";
    import { providerName } from "#lib/connections/labels";
    import { decideLocal } from "#lib/connections/local";
    import { decideViaProxy } from "#lib/connections/proxy";
    import RuntimeApp from "#lib/runtime/components/RuntimeApp.svelte";
    import RuntimeField from "#lib/runtime/components/RuntimeField.svelte";
    import type { InputValue } from "#lib/runtime/bindings";
    import { resolveTree, type ResolvedNode } from "#lib/runtime/render-model";
    import { createRunner } from "#lib/runtime/runner";
    import type { AppInput, AppQuestion, Blueprint } from "#lib/schema/blueprint";
    import type { ConnectionView } from "#lib/schema/connection";
    import type { GuestConnection } from "#lib/schema/guest";

    let {
        blueprint,
        accountConnections,
        signedIn,
        initialInputs = {}
    }: {
        blueprint: Blueprint;
        accountConnections: ConnectionView[];
        signedIn: boolean;
        initialInputs?: Record<string, string>;
    } = $props();

    const STORAGE_KEY = "jevil:runner-connection";

    /** Created once, at component level, so SSR can paint the sample result. */
    const runner = untrack(() => createRunner({ blueprint, inputs: initialInputs }));

    let snapshot = $state(untrack(() => runner.getSnapshot()));
    let inputs = $state<Record<string, InputValue>>(untrack(() => runner.inputValues));
    let guests = $state<GuestConnection[]>([]);
    let guestsLoaded = $state(false);
    let selection = $state("");

    $effect(() => {
        return runner.subscribe((next) => {
            snapshot = next;
            inputs = runner.inputValues;
        });
    });

    interface ConnectionOption {
        key: string;
        label: string;
        detail: string;
        group: "account" | "browser";
    }

    const accountOptions: ConnectionOption[] = $derived(
        accountConnections.map((connection) => ({
            key: `account:${connection.id}`,
            label: connection.label,
            detail: [providerName(connection.provider), connection.model]
                .filter(Boolean)
                .join(" · "),
            group: "account"
        }))
    );

    const guestOptions: ConnectionOption[] = $derived(
        guests.map((connection) => ({
            key: `guest:${connection.id}`,
            label: connection.label,
            detail: [
                providerName(connection.provider),
                connection.mode === "local" ? "local endpoint" : (connection.model ?? "hosted")
            ]
                .filter(Boolean)
                .join(" · "),
            group: "browser"
        }))
    );

    const options = $derived([...accountOptions, ...guestOptions]);
    const selected = $derived(options.find((option) => option.key === selection));

    /** Install exactly one transport for the current pick. */
    $effect(() => {
        const chosen = selected;

        if (!chosen) {
            runner.setTransport(undefined);
            return;
        }

        if (chosen.group === "account") {
            const connectionId = chosen.key.slice("account:".length);
            runner.setTransport((request, { signal }) =>
                decideViaAccount(connectionId, request, { signal })
            );
            return;
        }

        const guest = guests.find((connection) => `guest:${connection.id}` === chosen.key);
        if (!guest) {
            runner.setTransport(undefined);
            return;
        }

        if (guest.mode === "local") {
            runner.setTransport((request, { signal }) =>
                decideLocal(
                    {
                        baseUrl: guest.baseUrl,
                        model: guest.model,
                        secret: guest.secret,
                        headerName: guest.headerName
                    },
                    request,
                    { signal }
                )
            );
            return;
        }

        runner.setTransport((request, { signal }) => decideViaProxy(guest, request, { signal }));
    });

    let autoran = false;

    /** `meta.autorun` runs once, after a transport exists. */
    $effect(() => {
        if (autoran || !guestsLoaded || !selected || !blueprint.meta.autorun) return;
        autoran = true;
        void runner.run();
    });

    onMount(() => {
        let stored: string | null = null;
        try {
            stored = localStorage.getItem(STORAGE_KEY);
        } catch {
            stored = null;
        }

        void (async () => {
            try {
                guests = await listGuestConnections();
            } catch {
                guests = [];
            }
            guestsLoaded = true;

            const keys = [
                ...accountConnections.map((connection) => `account:${connection.id}`),
                ...guests.map((connection) => `guest:${connection.id}`)
            ];
            const first = keys[0] ?? "";
            const next = stored && keys.includes(stored) ? stored : first;
            selection = next;

            if (next) {
                try {
                    localStorage.setItem(STORAGE_KEY, next);
                } catch {
                    // Private mode, a full quota: the pick just won't persist.
                }
            }
        })();
    });

    $effect(() => {
        if (!selection) return;
        try {
            localStorage.setItem(STORAGE_KEY, selection);
        } catch {
            // Same as above; persistence is a convenience, not a requirement.
        }
    });

    const tree = $derived(resolveTree(blueprint, snapshot, inputs));

    /** Inputs the blueprint does not place in its own UI get generated controls. */
    const unusedInputs = $derived.by(() => {
        const used = new Set(tree.usedInputs);
        return blueprint.inputs.filter((input) => !used.has(input.id));
    });

    const FIELD_TYPES: Record<AppInput["type"], string> = {
        text: "TextInput",
        textarea: "TextArea",
        select: "Select",
        slider: "Slider",
        toggle: "Toggle",
        color: "ColorInput"
    };

    const fieldNode = (input: AppInput): ResolvedNode => ({
        id: `auto-${input.id}`,
        type: FIELD_TYPES[input.type],
        props: {
            input: input.id,
            label: input.label,
            ...(input.placeholder ? { placeholder: input.placeholder } : {}),
            ...(input.maxLength ? { maxLength: input.maxLength } : {}),
            ...(input.type === "slider" ? { showValue: true } : {})
        },
        children: []
    });

    const run = (): void => {
        void runner.run();
    };

    const reset = (): void => {
        runner.reset();
        inputs = runner.inputValues;
    };

    const percent = (value: number): string => `${Math.round(value * 100)}%`;

    const questionLabel = (question: AppQuestion, key: string): string => {
        if (question.type === "choice") return question.criteria[key] ?? key;

        if (question.type === "score") {
            const index = Number(key);
            return Number.isInteger(index) && question.criteria[index]
                ? question.criteria[index]!
                : key;
        }

        return key;
    };

    const chosenLabel = (question: AppQuestion, answer: Answer): string => {
        if (answer.type === "choice") return questionLabel(question, answer.choice);

        if (answer.type === "score") {
            const level =
                answer.level ??
                (question.type === "score"
                    ? Math.round(answer.score * (question.criteria.length - 1))
                    : undefined);
            const label =
                question.type === "score" && level !== undefined
                    ? question.criteria[level]
                    : undefined;

            return `${percent(answer.score)}${label ? ` · ${label}` : ""}`;
        }

        return percent(answer.noul);
    };

    interface DecidedQuestion {
        key: string;
        instructions: string;
        answer: Answer;
        chosen: string;
        probabilities: { label: string; value: number }[];
    }

    interface DecidedStep {
        id: string;
        label: string;
        questions: DecidedQuestion[];
    }

    const decided: DecidedStep[] = $derived.by(() =>
        blueprint.steps
            .map((step, index) => {
                const answers = snapshot.answers[step.id] ?? {};

                const questions = Object.entries(step.questions).flatMap<DecidedQuestion>(
                    ([key, question]) => {
                        const answer = answers[key];
                        if (!answer) return [];

                        const probabilities =
                            "probabilities" in answer
                                ? Object.entries(answer.probabilities)
                                      .map(([option, value]) => ({
                                          label: questionLabel(question, option),
                                          value
                                      }))
                                      .sort((left, right) => right.value - left.value)
                                : [];

                        return [
                            {
                                key,
                                instructions: question.instructions,
                                answer,
                                chosen: chosenLabel(question, answer),
                                probabilities
                            }
                        ];
                    }
                );

                return {
                    id: step.id,
                    label: step.label ?? m.app_detail_step({ index: index + 1 }),
                    questions
                };
            })
            .filter((step) => step.questions.length > 0)
    );
</script>

<div class="flex flex-col gap-5">
    <div class="flex flex-col gap-3 rounded-md border border-line bg-paper-2/60 p-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label class="flex flex-1 flex-col gap-1.5" for="runner-connection">
                <span class={labelClass}>{m.app_detail_connection()}</span>
                <select id="runner-connection" class={inputClass} bind:value={selection}>
                    {#if options.length === 0}
                        <option value="">{m.app_detail_no_connection()}</option>
                    {/if}
                    {#if accountOptions.length > 0}
                        <optgroup label={m.app_detail_connection_saved()}>
                            {#each accountOptions as option (option.key)}
                                <option value={option.key}>{option.label} — {option.detail}</option>
                            {/each}
                        </optgroup>
                    {/if}
                    {#if guestOptions.length > 0}
                        <optgroup label={m.app_detail_connection_browser()}>
                            {#each guestOptions as option (option.key)}
                                <option value={option.key}>{option.label} — {option.detail}</option>
                            {/each}
                        </optgroup>
                    {/if}
                </select>
            </label>
            <Button variant="secondary" href={resolve("/settings/connections")}>
                {m.app_detail_add()}
            </Button>
        </div>

        {#if selected}
            <p class="font-mono text-micro text-muted">
                {selected.group === "account"
                    ? m.app_detail_connection_saved()
                    : m.app_detail_connection_browser()} · {selected.detail}
            </p>
        {:else}
            <p class="text-small text-ink-2">{m.app_detail_no_connection_hint()}</p>
            {#if !signedIn}
                <p class="text-small text-muted">{m.app_detail_sign_in_hint()}</p>
            {/if}
        {/if}
    </div>

    {#if unusedInputs.length > 0}
        <div class="flex flex-col gap-4 rounded-md border border-line bg-paper p-5">
            <h2 class="text-h4">{m.app_detail_inputs()}</h2>
            {#each unusedInputs as input (input.id)}
                <div class="flex flex-col gap-1.5">
                    <RuntimeField
                        node={fieldNode(input)}
                        {input}
                        value={inputs[input.id] ?? ""}
                        onchange={(value) => runner.setInput(input.id, value)}
                    />
                    {#if input.help}
                        <p class="text-small text-muted">{input.help}</p>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}

    <div class="flex flex-wrap items-center gap-3">
        <Button
            onclick={run}
            disabled={snapshot.status === "running" || !selected}
            loading={snapshot.status === "running"}
        >
            {snapshot.status === "running"
                ? m.app_detail_running()
                : snapshot.status === "success"
                  ? m.app_detail_run_again()
                  : m.app_detail_run()}
        </Button>
        <Button variant="ghost" onclick={reset} disabled={snapshot.status === "running"}>
            {m.app_detail_reset()}
        </Button>
        {#if !selected}
            <span class="text-small text-muted">{m.app_detail_no_connection()}</span>
        {/if}
    </div>

    <RuntimeApp {blueprint} {runner} />

    <details class="rounded-md border border-line bg-paper-2/50 p-5">
        <summary class="cursor-pointer text-small font-semibold text-ink">
            {m.app_detail_decided()}
        </summary>
        <p class="mt-2 text-small text-ink-2">{m.app_detail_decided_hint()}</p>

        {#if decided.length === 0}
            <p class="mt-4 text-small text-muted">{m.app_detail_decided_empty()}</p>
        {:else}
            <div class="mt-5 flex flex-col gap-6">
                {#each decided as step (step.id)}
                    <section class="flex flex-col gap-3">
                        <h3 class="text-micro font-semibold tracking-[0.08em] text-muted uppercase">
                            {step.label}
                        </h3>
                        {#each step.questions as item (item.key)}
                            <div
                                class="flex flex-col gap-2 rounded-sm border border-line bg-paper p-4"
                            >
                                <div class="flex flex-wrap items-baseline justify-between gap-2">
                                    <p class="text-small text-ink-2">{item.instructions}</p>
                                    {#if "confidence" in item.answer}
                                        <span
                                            class="rounded-full border border-brand/25 bg-brand-soft px-2.5 py-0.5 font-mono text-micro text-brand"
                                        >
                                            {m.app_detail_confidence({
                                                percent: Math.round(item.answer.confidence * 100)
                                            })}
                                        </span>
                                    {/if}
                                </div>

                                <p class="text-body-lg font-semibold text-ink">
                                    <span class="sr-only">{m.app_detail_chose()}: </span>
                                    {item.chosen}
                                </p>

                                {#if item.probabilities.length > 0}
                                    <div class="flex flex-col gap-1.5">
                                        <span class="sr-only">{m.app_detail_probabilities()}</span>
                                        {#each item.probabilities as probability (probability.label)}
                                            <div
                                                class="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3"
                                            >
                                                <div class="flex items-center gap-3">
                                                    <progress
                                                        class="h-1.5 w-full accent-brand"
                                                        max="1"
                                                        value={probability.value}
                                                        aria-label={probability.label}
                                                    ></progress>
                                                    <span
                                                        class="w-28 shrink-0 truncate text-small text-ink-2"
                                                    >
                                                        {probability.label}
                                                    </span>
                                                </div>
                                                <span
                                                    class="text-right font-mono text-micro text-muted"
                                                >
                                                    {percent(probability.value)}
                                                </span>
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </section>
                {/each}
            </div>
        {/if}
    </details>
</div>
