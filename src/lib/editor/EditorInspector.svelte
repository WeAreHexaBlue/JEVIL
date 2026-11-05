<script lang="ts">
    import { m } from "#lib/paraglide/messages";
    import { inputClass, labelClass } from "#lib/components/field-styles";
    import { componentCatalog } from "#lib/runtime/catalog";
    import type { AppInput, AppMeta, Blueprint, UiNode } from "#lib/schema/blueprint";
    import type { BlueprintIssue } from "#lib/schema/blueprint";
    import { bindingChoices } from "./bindings";
    import { editableProps } from "./mutations";
    import EditorProp from "./EditorProp.svelte";
    import { accents } from "#lib/runtime/catalog";

    let {
        blueprint,
        selected: selectedNode,
        issues,
        onprop,
        onmeta,
        oninput,
        onremoveinput,
        onaddinput,
        onissue
    }: {
        blueprint: Blueprint;
        selected: UiNode | null;
        issues: BlueprintIssue[];
        onprop: (key: string, value: unknown | undefined) => void;
        onmeta: (patch: Partial<AppMeta>) => void;
        oninput: (input: AppInput) => void;
        onremoveinput: (id: string) => void;
        onaddinput: () => void;
        onissue: (pointer: string) => void;
    } = $props();

    type Panel = "props" | "meta" | "data" | "issues";

    let panel = $state<Panel>("props");

    const choices = $derived(bindingChoices(blueprint));

    const propRows = $derived.by(() => {
        const node = selectedNode;
        if (!node) return [];

        const spec = componentCatalog[node.type];
        const keys: string[] = [
            ...editableProps(node.type).map((prop) => prop.key),
            ...Object.keys(node.props ?? {}).filter(
                (key) => !editableProps(node.type).some((prop) => prop.key === key)
            )
        ];

        return keys.map((key) => ({
            key,
            required: spec?.required.includes(key) ?? false,
            spec: spec?.props[key],
            value: node.props?.[key]
        }));
    });

    const inputDefaults = (type: AppInput["type"]): string =>
        type === "toggle" ? "false" : type === "slider" ? "0" : "";

    const changeInputType = (input: AppInput, type: AppInput["type"]): void => {
        oninput({
            ...input,
            type,
            default: input.default === undefined ? inputDefaults(type) : input.default,
            ...(type === "slider" ? { min: 0, max: 100, step: 1 } : {})
        });
    };

    const tabs: { id: Panel; label: string }[] = [
        { id: "props", label: m.editor_props() },
        { id: "meta", label: m.editor_meta() },
        { id: "data", label: m.editor_data() },
        { id: "issues", label: m.editor_issues() }
    ];
</script>

<aside class="flex min-h-0 flex-col gap-4" aria-label="Inspector">
    <div class="flex flex-wrap gap-1" role="tablist" aria-label="Inspector sections">
        {#each tabs as tab (tab.id)}
            <button
                type="button"
                role="tab"
                aria-selected={panel === tab.id}
                class={panel === tab.id
                    ? "rounded-full bg-ink px-3 py-1 text-micro font-semibold text-paper"
                    : "rounded-full px-3 py-1 text-micro font-semibold text-ink-2 hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"}
                onclick={() => (panel = tab.id)}
            >
                {tab.label}
                {#if tab.id === "issues" && issues.length > 0}
                    <span class="ml-1 rounded-full bg-red px-1.5 text-[10px] text-paper">
                        {issues.length}
                    </span>
                {/if}
            </button>
        {/each}
    </div>

    <div class="min-h-0 overflow-y-auto pr-1">
        {#if panel === "props"}
            {#if selectedNode}
                <div class="flex flex-col gap-2">
                    <div class="flex items-baseline justify-between gap-2">
                        <h2 class="text-h4">{selectedNode.type}</h2>
                        <span class="font-mono text-micro text-muted">#{selectedNode.id}</span>
                    </div>

                    {#if !componentCatalog[selectedNode.type]}
                        <p class="text-small text-red">Unknown component type.</p>
                    {/if}

                    {#each propRows as prop (prop.key)}
                        <EditorProp
                            name={prop.key}
                            value={prop.value}
                            spec={prop.spec}
                            required={prop.required}
                            inputs={blueprint.inputs}
                            {choices}
                            onchange={(value) => onprop(prop.key, value)}
                        />
                    {/each}

                    {#if propRows.length === 0}
                        <p class="text-small text-muted">This component has no props.</p>
                    {/if}
                </div>
            {:else}
                <p class="text-small text-muted">{m.editor_no_selection()}</p>
            {/if}
        {:else if panel === "meta"}
            <div class="flex flex-col gap-4">
                <label class="flex flex-col gap-1.5">
                    <span class={labelClass}>{m.editor_meta_title()}</span>
                    <input
                        class={inputClass}
                        value={blueprint.meta.title}
                        maxlength="48"
                        oninput={(event) => onmeta({ title: event.currentTarget.value })}
                    />
                </label>
                <label class="flex flex-col gap-1.5">
                    <span class={labelClass}>{m.editor_meta_tagline()}</span>
                    <input
                        class={inputClass}
                        value={blueprint.meta.tagline}
                        maxlength="120"
                        oninput={(event) => onmeta({ tagline: event.currentTarget.value })}
                    />
                </label>
                <label class="flex flex-col gap-1.5">
                    <span class={labelClass}>{m.editor_meta_description()}</span>
                    <textarea
                        class="min-h-24 w-full rounded-sm border-[1.5px] border-line bg-paper-2 px-4 py-3 text-body text-ink focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none"
                        value={blueprint.meta.description ?? ""}
                        maxlength="2000"
                        oninput={(event) => onmeta({ description: event.currentTarget.value })}
                    ></textarea>
                </label>
                <label class="flex flex-col gap-1.5">
                    <span class={labelClass}>{m.editor_meta_tags()}</span>
                    <input
                        class={inputClass}
                        value={blueprint.meta.tags.join(", ")}
                        oninput={(event) =>
                            onmeta({
                                tags: event.currentTarget.value
                                    .split(",")
                                    .map((tag) => tag.trim().toLowerCase())
                                    .filter(Boolean)
                            })}
                    />
                </label>
                <label class="flex flex-col gap-1.5">
                    <span class={labelClass}>{m.editor_meta_icon()}</span>
                    <input
                        class={inputClass}
                        value={blueprint.meta.icon}
                        maxlength="40"
                        oninput={(event) => onmeta({ icon: event.currentTarget.value })}
                    />
                </label>
                <label class="flex flex-col gap-1.5">
                    <span class={labelClass}>{m.editor_meta_accent()}</span>
                    <select
                        class={inputClass}
                        value={blueprint.meta.accent}
                        onchange={(event) =>
                            onmeta({ accent: event.currentTarget.value as AppMeta["accent"] })}
                    >
                        {#each accents as accent (accent)}
                            <option value={accent}>{accent}</option>
                        {/each}
                    </select>
                </label>
            </div>
        {:else if panel === "data"}
            <div class="flex flex-col gap-5">
                <section class="flex flex-col gap-2">
                    <div class="flex items-center justify-between gap-2">
                        <h2 class="text-small font-semibold text-ink">{m.editor_inputs()}</h2>
                        <button
                            type="button"
                            class="rounded-sm border border-line bg-paper-2 px-2.5 py-1 text-micro font-semibold text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            onclick={onaddinput}
                        >
                            {m.editor_add_input()}
                        </button>
                    </div>

                    {#each blueprint.inputs as input (input.id)}
                        <div class="flex flex-col gap-2 rounded-sm border border-line bg-paper p-3">
                            <div class="grid grid-cols-2 gap-2">
                                <label class="flex flex-col gap-1">
                                    <span class="text-micro text-muted">{m.editor_input_id()}</span>
                                    <input
                                        class="h-8 rounded-sm border border-line bg-paper-2 px-2 font-mono text-micro text-ink focus:border-brand focus:outline-none"
                                        value={input.id}
                                        oninput={(event) =>
                                            oninput({ ...input, id: event.currentTarget.value })}
                                    />
                                </label>
                                <label class="flex flex-col gap-1">
                                    <span class="text-micro text-muted"
                                        >{m.editor_input_type()}</span
                                    >
                                    <select
                                        class="h-8 rounded-sm border border-line bg-paper-2 px-2 text-micro text-ink focus:border-brand focus:outline-none"
                                        value={input.type}
                                        onchange={(event) =>
                                            changeInputType(
                                                input,
                                                event.currentTarget.value as AppInput["type"]
                                            )}
                                    >
                                        {#each ["text", "textarea", "select", "slider", "toggle", "color"] as type (type)}
                                            <option value={type}>{type}</option>
                                        {/each}
                                    </select>
                                </label>
                            </div>
                            <label class="flex flex-col gap-1">
                                <span class="text-micro text-muted">{m.editor_input_label()}</span>
                                <input
                                    class="h-8 rounded-sm border border-line bg-paper-2 px-2 text-micro text-ink focus:border-brand focus:outline-none"
                                    value={input.label}
                                    oninput={(event) =>
                                        oninput({ ...input, label: event.currentTarget.value })}
                                />
                            </label>
                            <label class="flex flex-col gap-1">
                                <span class="text-micro text-muted">{m.editor_input_default()}</span
                                >
                                <input
                                    class="h-8 rounded-sm border border-line bg-paper-2 px-2 font-mono text-micro text-ink focus:border-brand focus:outline-none"
                                    value={input.default == null ? "" : String(input.default)}
                                    oninput={(event) =>
                                        oninput({ ...input, default: event.currentTarget.value })}
                                />
                            </label>
                            <div class="flex items-center justify-between gap-2">
                                <label class="flex items-center gap-2 text-micro text-ink-2">
                                    <input
                                        type="checkbox"
                                        class="size-3.5 accent-brand"
                                        checked={input.required === true}
                                        onchange={(event) =>
                                            oninput({
                                                ...input,
                                                required: event.currentTarget.checked
                                            })}
                                    />
                                    {m.editor_input_required()}
                                </label>
                                <button
                                    type="button"
                                    class="text-micro text-muted underline-offset-2 hover:text-red hover:underline"
                                    onclick={() => onremoveinput(input.id)}
                                >
                                    {m.editor_remove_input()}
                                </button>
                            </div>
                        </div>
                    {/each}
                </section>

                <section class="flex flex-col gap-2">
                    <h2 class="text-small font-semibold text-ink">{m.editor_questions()}</h2>
                    {#if blueprint.steps.length === 0}
                        <p class="text-small text-muted">{m.editor_steps_empty()}</p>
                    {:else}
                        {#each blueprint.steps as step (step.id)}
                            <div class="rounded-sm border border-line bg-paper p-3">
                                <p class="flex items-baseline justify-between gap-2">
                                    <span class="text-small font-semibold text-ink">
                                        {step.label ?? step.id}
                                    </span>
                                    <span class="font-mono text-micro text-muted">#{step.id}</span>
                                </p>
                                <ul class="mt-2 flex flex-col gap-1">
                                    {#each Object.entries(step.questions) as [key, question] (key)}
                                        <li
                                            class="flex items-baseline justify-between gap-2 text-micro"
                                        >
                                            <span class="font-mono text-ink-2">{key}</span>
                                            <span class="text-muted">
                                                {question.type}
                                                {#if question.type === "choice"}
                                                    · {Object.keys(question.criteria).length} options
                                                {:else if question.type === "score"}
                                                    · {question.criteria.length} levels
                                                {/if}
                                            </span>
                                        </li>
                                    {/each}
                                </ul>
                            </div>
                        {/each}
                    {/if}
                </section>

                <section class="flex flex-col gap-2">
                    <h2 class="text-small font-semibold text-ink">{m.editor_vars()}</h2>
                    {#if Object.keys(blueprint.vars).length === 0}
                        <p class="text-small text-muted">No derived vars yet.</p>
                    {:else}
                        {#each Object.entries(blueprint.vars) as [name, definition] (name)}
                            <div
                                class="flex items-baseline justify-between gap-2 rounded-sm border border-line bg-paper p-2"
                            >
                                <span class="font-mono text-micro text-ink">{name}</span>
                                <span class="text-micro text-muted">{definition.type}</span>
                            </div>
                        {/each}
                    {/if}
                </section>
            </div>
        {:else}
            <div class="flex flex-col gap-2">
                {#if issues.length === 0}
                    <p
                        class="rounded-sm border border-lime/40 bg-lime/15 px-3 py-2 text-small text-ink"
                    >
                        {m.editor_no_issues()}
                    </p>
                {:else}
                    {#each issues as issue, index (index)}
                        <button
                            type="button"
                            class="flex flex-col items-start gap-1 rounded-sm border border-red/30 bg-red/5 px-3 py-2 text-left hover:bg-red/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            onclick={() => onissue(issue.pointer)}
                        >
                            <span class="font-mono text-micro text-red">{issue.pointer || "/"}</span
                            >
                            <span class="text-small text-ink">{issue.message}</span>
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
</aside>
