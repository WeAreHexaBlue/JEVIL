<script lang="ts">
    import { untrack } from "svelte";
    import { m } from "#lib/paraglide/messages";
    import { inputClass } from "#lib/components/field-styles";
    import { inputComponentTypes, type PropSpec } from "#lib/runtime/catalog";
    import type { BindingChoice } from "./bindings";
    import type { AppInput, PropValue } from "#lib/schema/blueprint";

    let {
        name,
        value,
        spec,
        required,
        inputs,
        choices,
        onchange
    }: {
        name: string;
        value: unknown;
        spec: PropSpec | undefined;
        required: boolean;
        inputs: AppInput[];
        choices: BindingChoice[];
        onchange: (value: PropValue | undefined) => void;
    } = $props();

    const isBindingValue = (candidate: unknown): boolean =>
        typeof candidate === "object" &&
        candidate !== null &&
        !Array.isArray(candidate) &&
        ("lit" in candidate ||
            "var" in candidate ||
            "step" in candidate ||
            "template" in candidate);

    const bound = $derived(isBindingValue(value));
    const bindingJson = $derived(JSON.stringify(value, null, 2));
    const jsonText = $derived(JSON.stringify(value ?? null, null, 2));

    let raw = $state(untrack(() => jsonText));
    let rawError = $state("");

    $effect(() => {
        raw = jsonText;
        rawError = "";
    });

    const kind = $derived.by(() => {
        if (bound) return "binding";
        if (spec?.inputRef) return "input";
        if (spec?.type === "boolean") return "boolean";
        if (spec?.type === "integer" || spec?.type === "number") return "number";
        if (spec?.type === "enum") return "enum";
        if (spec?.type === "color") return "color";
        if (spec?.type === "strings" || spec?.type === "colors" || spec?.type === "record")
            return "json";
        if (spec?.type === "action") return "json";
        if (spec?.type === "any") {
            if (typeof value === "number") return "number";
            if (typeof value === "boolean") return "boolean";
            if (typeof value === "object" && value !== null) return "json";
            return "text";
        }
        if (typeof value === "number") return "number";
        if (typeof value === "boolean") return "boolean";
        if (typeof value === "object" && value !== null) return "json";
        return "text";
    });

    const currentChoice = $derived(
        bound ? (choices.find((choice) => choice.value === JSON.stringify(value))?.value ?? "") : ""
    );

    const wantedInputType = $derived(
        name === "input" ? inputComponentTypes[String(value)] : undefined
    );

    const compatibleInputs = $derived(
        spec?.inputRef
            ? inputs.filter((input) => !wantedInputType || input.type === wantedInputType)
            : []
    );

    const applyRaw = (): void => {
        try {
            const parsed = JSON.parse(raw) as PropValue;
            rawError = "";
            onchange(parsed);
        } catch {
            rawError = m.editor_json_invalid();
        }
    };

    const chooseBinding = (encoded: string): void => {
        if (!encoded) {
            onchange("");
            return;
        }

        try {
            onchange(JSON.parse(encoded) as PropValue);
        } catch {
            rawError = m.editor_json_invalid();
        }
    };
</script>

<div class="flex flex-col gap-1.5 rounded-sm border border-line bg-paper p-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
        <label class="font-mono text-micro font-semibold text-ink" for={`prop-${name}`}>
            {name}
        </label>
        <div class="flex items-center gap-2">
            {#if required}
                <span
                    class="rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-micro text-ink"
                >
                    {m.editor_required()}
                </span>
            {/if}
            {#if !required && value !== undefined}
                <button
                    type="button"
                    class="text-micro text-muted underline-offset-2 hover:text-red hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    onclick={() => onchange(undefined)}
                >
                    {m.editor_remove()}
                </button>
            {/if}
        </div>
    </div>

    {#if choices.length > 0}
        <label class="flex items-center gap-2 text-micro text-muted">
            {m.editor_bind()}
            <select
                class="h-8 min-w-0 flex-1 rounded-sm border border-line bg-paper-2 px-2 text-micro text-ink focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none"
                value={currentChoice}
                onchange={(event) => chooseBinding(event.currentTarget.value)}
            >
                <option value="">{bound ? "Custom binding" : m.editor_literal()}</option>
                {#each choices as choice (choice.value)}
                    <option value={choice.value}>{choice.group} · {choice.label}</option>
                {/each}
            </select>
        </label>
    {/if}

    {#if bound}
        <p class="truncate font-mono text-micro text-brand">{bindingJson}</p>
    {:else if kind === "input"}
        <select
            id={`prop-${name}`}
            class={inputClass}
            value={typeof value === "string" ? value : ""}
            onchange={(event) => onchange(event.currentTarget.value)}
        >
            <option value="">Choose an input</option>
            {#each compatibleInputs as input (input.id)}
                <option value={input.id}>{input.label} · {input.type}</option>
            {/each}
        </select>
    {:else if kind === "boolean"}
        <label class="flex items-center gap-2 text-small text-ink-2">
            <input
                id={`prop-${name}`}
                type="checkbox"
                class="size-4 accent-brand"
                checked={value === true}
                onchange={(event) => onchange(event.currentTarget.checked)}
            />
            {value === true ? "true" : "false"}
        </label>
    {:else if kind === "enum"}
        <select
            id={`prop-${name}`}
            class={inputClass}
            value={typeof value === "string" ? value : ""}
            onchange={(event) =>
                onchange(event.currentTarget.value === "" ? undefined : event.currentTarget.value)}
        >
            <option value="">Default</option>
            {#each spec?.values ?? [] as option (option)}
                <option value={option}>{option}</option>
            {/each}
        </select>
    {:else if kind === "number"}
        <input
            id={`prop-${name}`}
            type="number"
            class={inputClass}
            value={typeof value === "number" ? value : ""}
            min={spec?.min}
            max={spec?.max}
            step={spec?.type === "integer" ? 1 : "any"}
            oninput={(event) => {
                const next = event.currentTarget.value;
                if (next === "") onchange(undefined);
                else onchange(Number(next));
            }}
        />
    {:else if kind === "color"}
        <div class="flex items-center gap-2">
            <input
                id={`prop-${name}`}
                type="text"
                class={inputClass}
                value={typeof value === "string" ? value : ""}
                placeholder="#8b5cf6"
                oninput={(event) => onchange(event.currentTarget.value)}
            />
            <input
                type="color"
                aria-label={`${name} colour picker`}
                class="size-10 shrink-0 rounded-sm border border-line bg-paper-2"
                value={/^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : "#8b5cf6"}
                oninput={(event) => onchange(event.currentTarget.value)}
            />
        </div>
    {:else if kind === "json"}
        <textarea
            id={`prop-${name}`}
            class="min-h-20 w-full rounded-sm border-[1.5px] border-line bg-paper-2 px-3 py-2 font-mono text-micro text-ink focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none"
            bind:value={raw}
            spellcheck="false"></textarea>
        {#if rawError}
            <p class="text-micro text-red">{rawError}</p>
        {/if}
        <button
            type="button"
            class="w-fit rounded-sm border border-line bg-paper-2 px-2.5 py-1 text-micro font-semibold text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            onclick={applyRaw}
        >
            {m.editor_json_apply()}
        </button>
    {:else}
        <input
            id={`prop-${name}`}
            type="text"
            class={inputClass}
            value={typeof value === "string" ? value : value == null ? "" : String(value)}
            oninput={(event) => onchange(event.currentTarget.value)}
        />
    {/if}

    {#if spec?.type === "any" && !bound && kind !== "json"}
        <p class="text-micro text-muted">Text, number, or bind to a value.</p>
    {/if}

    {#if required && value === undefined}
        <p class="text-micro text-red">This prop is required.</p>
    {/if}
</div>
