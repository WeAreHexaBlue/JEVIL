<script lang="ts">
    import type { Blueprint, UiNode } from "#lib/schema/blueprint";
    import { findParent } from "./mutations";
    import { isContainer } from "./defaults";
    import { cn } from "#lib/utils/cn";

    let {
        blueprint,
        selectedId,
        onselect,
        onmove,
        onduplicate,
        ondelete
    }: {
        blueprint: Blueprint;
        selectedId: string;
        onselect: (id: string) => void;
        onmove: (id: string, delta: -1 | 1) => void;
        onduplicate: (id: string) => void;
        ondelete: (id: string) => void;
    } = $props();

    const path = $derived.by(() => {
        const walk = (node: UiNode): UiNode[] | null => {
            if (node.id === selectedId) return [node];
            for (const child of node.children ?? []) {
                const found = walk(child);
                if (found) return [node, ...found];
            }
            return null;
        };

        return walk(blueprint.ui) ?? [];
    });

    const isRoot = (id: string): boolean => id === blueprint.ui.id;
    const siblingCount = (id: string): number =>
        findParent(blueprint.ui, id)?.parent.children?.length ?? 0;
    const siblingIndex = (id: string): number => findParent(blueprint.ui, id)?.index ?? -1;
</script>

{#snippet nodeRow(node: UiNode, depth: number)}
    {@const selected = node.id === selectedId}
    {@const root = isRoot(node.id)}
    <li class="flex flex-col gap-1">
        <div
            class={cn(
                "flex items-center gap-1 rounded-sm border-[1.5px] px-2 py-1.5 transition-colors",
                selected
                    ? "border-brand bg-brand-soft"
                    : "border-transparent hover:border-line hover:bg-paper-2"
            )}
            style={`margin-left: ${depth * 14}px`}
        >
            <button
                type="button"
                class="flex min-w-0 flex-1 items-baseline gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                aria-pressed={selected}
                onclick={() => onselect(node.id)}
            >
                <span class="text-small font-semibold text-ink">{node.type}</span>
                <span class="truncate font-mono text-micro text-muted">#{node.id}</span>
                <span class="ml-auto shrink-0 font-mono text-micro text-muted">
                    {root ? "root" : isContainer(node.type) ? "container" : ""}
                </span>
            </button>

            {#if !root}
                <div class="flex shrink-0 items-center gap-0.5">
                    <button
                        type="button"
                        class="rounded-sm px-1.5 py-0.5 text-micro text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-30"
                        aria-label={`Move ${node.type} up`}
                        disabled={siblingIndex(node.id) <= 0}
                        onclick={() => onmove(node.id, -1)}
                    >
                        ↑
                    </button>
                    <button
                        type="button"
                        class="rounded-sm px-1.5 py-0.5 text-micro text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-30"
                        aria-label={`Move ${node.type} down`}
                        disabled={siblingIndex(node.id) >= siblingCount(node.id) - 1}
                        onclick={() => onmove(node.id, 1)}
                    >
                        ↓
                    </button>
                    <button
                        type="button"
                        class="rounded-sm px-1.5 py-0.5 text-micro text-muted hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        aria-label={`Duplicate ${node.type}`}
                        onclick={() => onduplicate(node.id)}
                    >
                        ⧉
                    </button>
                    <button
                        type="button"
                        class="rounded-sm px-1.5 py-0.5 text-micro text-muted hover:bg-red/10 hover:text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        aria-label={`Delete ${node.type}`}
                        onclick={() => ondelete(node.id)}
                    >
                        ✕
                    </button>
                </div>
            {/if}
        </div>

        {#if node.children && node.children.length > 0}
            <ul class="flex flex-col gap-1">
                {#each node.children as child (child.id)}
                    {@render nodeRow(child, depth + 1)}
                {/each}
            </ul>
        {:else if isContainer(node.type)}
            <p
                class="rounded-sm border border-dashed border-line px-2 py-1.5 text-micro text-muted"
                style={`margin-left: ${(depth + 1) * 14}px`}
            >
                Empty container. Select it, then add a component.
            </p>
        {/if}
    </li>
{/snippet}

<div class="flex flex-col gap-4">
    <nav aria-label="Selected component path">
        <ol class="flex flex-wrap items-center gap-1 font-mono text-micro text-muted">
            {#each path as node, index (node.id)}
                {#if index > 0}
                    <li aria-hidden="true">/</li>
                {/if}
                <li>
                    <button
                        type="button"
                        class="rounded-sm px-1 py-0.5 hover:bg-paper-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        aria-current={index === path.length - 1 ? "true" : undefined}
                        onclick={() => onselect(node.id)}
                    >
                        {node.type}
                    </button>
                </li>
            {/each}
        </ol>
    </nav>

    <ul class="flex flex-col gap-1">
        {@render nodeRow(blueprint.ui, 0)}
    </ul>
</div>
