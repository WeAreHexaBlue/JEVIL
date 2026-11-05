<script lang="ts">
    import { untrack } from "svelte";
    import type { AppInput, Blueprint } from "#lib/schema/blueprint";
    import type { InputValue } from "../bindings";
    import type { BlueprintRunner } from "../runner";
    import type { IconName } from "../catalog";
    import {
        resolveTree,
        textValue,
        type ResolvedAction,
        type ResolvedNode
    } from "../render-model";
    import {
        cardRadius,
        cardTones,
        columnClasses,
        gapClasses,
        paddingClasses,
        pick,
        pickIndex,
        spacerClasses,
        stackAlign,
        stackJustify
    } from "./classes";
    import RuntimeDisplay from "./RuntimeDisplay.svelte";
    import RuntimeField from "./RuntimeField.svelte";
    import RuntimeIcon from "./RuntimeIcon.svelte";
    import Button from "#lib/components/Button.svelte";
    import { cn } from "#lib/utils/cn";

    let {
        blueprint,
        runner,
        showStatus = true,
        class: className = ""
    }: {
        blueprint: Blueprint;
        runner: BlueprintRunner;
        showStatus?: boolean;
        class?: string;
    } = $props();

    let snapshot = $state(untrack(() => runner.getSnapshot()));
    let inputs = $state<Record<string, InputValue>>(untrack(() => runner.inputValues));
    let note = $state("");

    $effect(() => {
        const stop = runner.subscribe((next) => {
            snapshot = next;
            inputs = runner.inputValues;
        });

        snapshot = runner.getSnapshot();
        inputs = runner.inputValues;

        return stop;
    });

    const tree = $derived(resolveTree(blueprint, snapshot, inputs));
    const inputById = $derived(
        Object.fromEntries(blueprint.inputs.map((input) => [input.id, input])) as Record<
            string,
            AppInput
        >
    );
    const running = $derived(snapshot.status === "running");
    const preview = $derived(snapshot.status === "preview");

    const run = (): void => {
        void runner.run();
    };

    const setField = (id: string, value: unknown): void => {
        runner.setInput(id, value);
        inputs = runner.inputValues;
    };

    const copy = async (text: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text);
            note = "Copied to the clipboard.";
        } catch {
            note = "Could not copy. Select the text and copy it yourself.";
        }
        setTimeout(() => {
            note = "";
        }, 2200);
    };

    const perform = (action: ResolvedAction | undefined): void => {
        if (!action) return;

        switch (action.kind) {
            case "run":
                run();
                break;
            case "reset":
                runner.reset();
                inputs = runner.inputValues;
                break;
            case "set":
                setField(action.input, action.value);
                break;
            case "copy":
                void copy(action.text);
                break;
            case "open":
                window.open(action.url, "_blank", "noopener,noreferrer");
                break;
            case "none":
                break;
        }
    };
</script>

{#snippet renderNode(node: ResolvedNode)}
    {#if node.type === "Stack"}
        <div
            class={cn(
                "flex",
                node.props.direction === "row" ? "flex-row" : "flex-col",
                pickIndex(gapClasses, node.props.gap, 4),
                pick(stackAlign, node.props.align, ""),
                pick(stackJustify, node.props.justify, ""),
                typeof node.props.padding === "number"
                    ? pickIndex(paddingClasses, node.props.padding, 0)
                    : "",
                node.props.wrap === true ? "flex-wrap" : ""
            )}
        >
            {#each node.children as child (child.id)}
                {@render renderNode(child)}
            {/each}
        </div>
    {:else if node.type === "Grid"}
        <div
            class={cn(
                "grid",
                pickIndex(columnClasses, node.props.columns, 1),
                typeof node.props.gap === "number" ? pickIndex(gapClasses, node.props.gap, 0) : "",
                node.props.align === "stretch" ? "items-stretch" : "items-start"
            )}
        >
            {#each node.children as child (child.id)}
                {@render renderNode(child)}
            {/each}
        </div>
    {:else if node.type === "Card"}
        <div
            class={cn(
                "border-[1.5px]",
                pick(cardTones, node.props.tone, cardTones.paper),
                typeof node.props.padding === "number"
                    ? pickIndex(paddingClasses, node.props.padding, 5)
                    : "p-5",
                pick(cardRadius, node.props.radius, "rounded-md")
            )}
        >
            {#each node.children as child (child.id)}
                {@render renderNode(child)}
            {/each}
        </div>
    {:else if node.type === "Spacer"}
        <div
            class={spacerClasses[
                Math.min(16, Math.max(0, Math.round(Number(node.props.size) || 0)))
            ] ?? "h-0"}
            aria-hidden="true"
        ></div>
    {:else if node.type === "Divider"}
        <div class="flex items-center gap-3" role="separator">
            <span class="h-px flex-1 bg-line"></span>
            {#if node.props.label}
                <span class="text-micro font-semibold tracking-[0.08em] text-muted uppercase">
                    {textValue(node.props.label)}
                </span>
                <span class="h-px flex-1 bg-line"></span>
            {/if}
        </div>
    {:else if ["TextInput", "TextArea", "Select", "Slider", "Toggle", "ColorInput"].includes(node.type)}
        {@const input = inputById[String(node.props.input)]}
        {#if input}
            <RuntimeField
                {node}
                {input}
                value={inputs[input.id] ?? ""}
                onchange={(value) => setField(input.id, value)}
            />
        {/if}
    {:else if node.type === "Button"}
        <Button
            variant={(node.props.variant as "primary" | "secondary" | "ghost" | "danger") ??
                "primary"}
            fullWidth={node.props.fullWidth === true}
            disabled={running || node.props.disabled === true}
            onclick={() => perform(node.action)}
        >
            {textValue(node.props.label)}
        </Button>
    {:else if node.type === "IconButton"}
        <button
            type="button"
            class={cn(
                "inline-flex size-11 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40",
                node.props.variant === "danger"
                    ? "bg-red text-paper hover:opacity-90"
                    : node.props.variant === "secondary"
                      ? "border-[1.5px] border-ink bg-paper text-ink hover:bg-paper-2"
                      : node.props.variant === "ghost"
                        ? "text-ink hover:bg-paper-2"
                        : "bg-brand text-on-brand hover:bg-brand-strong"
            )}
            aria-label={textValue(node.props.label)}
            disabled={running}
            onclick={() => perform(node.action)}
        >
            <RuntimeIcon name={(node.props.icon as IconName) ?? "spark"} size={20} />
        </button>
    {:else}
        <RuntimeDisplay {node} />
    {/if}
{/snippet}

<div class={cn("flex flex-col gap-5", className)}>
    {#if showStatus}
        <div class="flex flex-col gap-3" aria-live="polite">
            {#if preview}
                <span
                    class="inline-flex w-fit items-center rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-micro font-semibold text-brand"
                >
                    Sample result
                </span>
            {/if}
            {#if running}
                <span class="text-small text-ink-2">Running…</span>
            {/if}
            {#if snapshot.stale}
                <span class="text-small text-ink-2">Inputs changed — run it again.</span>
            {/if}
            {#if note}
                <span class="text-small text-ink-2">{note}</span>
            {/if}
            {#if snapshot.status === "cancelled"}
                <span class="text-small text-ink-2"
                    >Cancelled. The last finished step is still here.</span
                >
            {/if}
            {#if snapshot.error}
                <div
                    class="flex flex-col gap-3 rounded-sm border-[1.5px] border-red/40 bg-red/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                    role="alert"
                >
                    <span class="flex items-start gap-2 text-small text-ink">
                        <span class="mt-0.5 text-red">
                            <RuntimeIcon name="warning" size={18} />
                        </span>
                        {snapshot.error.message}
                    </span>
                    <Button variant="secondary" onclick={run}>Try again</Button>
                </div>
            {/if}
        </div>
    {/if}

    {#if tree.root}
        {@render renderNode(tree.root)}
    {/if}
</div>
