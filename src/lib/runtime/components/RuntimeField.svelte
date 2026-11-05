<script lang="ts">
    import type { AppInput } from "#lib/schema/blueprint";
    import type { InputValue } from "../bindings";
    import type { ResolvedNode } from "../render-model";
    import { inputClass, labelClass } from "#lib/components/field-styles";

    let {
        node,
        input,
        value,
        onchange
    }: {
        node: ResolvedNode;
        input: AppInput;
        value: InputValue;
        onchange: (value: InputValue) => void;
    } = $props();

    const id = $derived(`field-${node.id}`);
    const label = $derived(
        typeof node.props.label === "string" && node.props.label.length > 0
            ? node.props.label
            : input.label
    );
    const placeholder = $derived(
        typeof node.props.placeholder === "string"
            ? node.props.placeholder
            : (input.placeholder ?? "")
    );
    const textValue = $derived(typeof value === "string" ? value : String(value));
    const limit = $derived(
        typeof node.props.maxLength === "number" ? node.props.maxLength : (input.maxLength ?? 4000)
    );
    const rows = $derived(typeof node.props.rows === "number" ? node.props.rows : 4);
    const showValue = $derived(node.props.showValue === true);
</script>

{#if node.type === "TextInput"}
    <label class="flex flex-col gap-2" for={id}>
        <span class={labelClass}>{label}</span>
        <input
            {id}
            class={inputClass}
            type="text"
            {placeholder}
            maxlength={limit}
            value={textValue}
            oninput={(event) => onchange(event.currentTarget.value)}
        />
    </label>
{:else if node.type === "TextArea"}
    <label class="flex flex-col gap-2" for={id}>
        <span class={labelClass}>{label}</span>
        <textarea
            {id}
            class={`${inputClass} h-auto py-3`}
            {placeholder}
            {rows}
            maxlength={limit}
            value={textValue}
            oninput={(event) => onchange(event.currentTarget.value)}></textarea>
    </label>
{:else if node.type === "Select"}
    <label class="flex flex-col gap-2" for={id}>
        <span class={labelClass}>{label}</span>
        <select
            {id}
            class={inputClass}
            value={textValue}
            onchange={(event) => onchange(event.currentTarget.value)}
        >
            {#each input.options ?? [] as option (option.value)}
                <option value={option.value}>{option.label}</option>
            {/each}
        </select>
    </label>
{:else if node.type === "Slider"}
    <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-3">
            <label class={labelClass} for={id}>{label}</label>
            {#if showValue}
                <output class="font-mono text-small text-ink-2" for={id}>
                    {typeof value === "number" ? value : input.min}
                </output>
            {/if}
        </div>
        <input
            {id}
            class="h-2 w-full cursor-pointer appearance-none rounded-full bg-paper-3 accent-brand"
            type="range"
            min={input.min ?? 0}
            max={input.max ?? 1}
            step={input.step ?? 0.1}
            value={typeof value === "number" ? value : (input.min ?? 0)}
            oninput={(event) => onchange(Number(event.currentTarget.value))}
        />
    </div>
{:else if node.type === "Toggle"}
    <label
        class="flex cursor-pointer items-center justify-between gap-4 rounded-sm border-[1.5px] border-line bg-paper-2 px-4 py-3"
        for={id}
    >
        <span class={labelClass}>{label}</span>
        <input
            {id}
            class="size-5 accent-brand"
            type="checkbox"
            checked={value === true}
            onchange={(event) => onchange(event.currentTarget.checked)}
        />
    </label>
{:else if node.type === "ColorInput"}
    <label class="flex flex-col gap-2" for={id}>
        <span class={labelClass}>{label}</span>
        <span class="flex items-center gap-3">
            <input
                {id}
                class="size-11 cursor-pointer rounded-sm border-[1.5px] border-line bg-paper-2 p-1"
                type="color"
                value={textValue}
                oninput={(event) => onchange(event.currentTarget.value)}
            />
            <span class="font-mono text-small text-ink-2">{textValue}</span>
        </span>
    </label>
{/if}
