<script lang="ts">
    import { m } from "#lib/paraglide/messages";
    import { componentCatalog } from "#lib/runtime/catalog";
    import type { AppInput } from "#lib/schema/blueprint";
    import { canAdd, componentSummary, paletteGroups } from "./defaults";

    let {
        inputs,
        onadd
    }: {
        inputs: AppInput[];
        onadd: (type: string) => void;
    } = $props();

    let query = $state("");

    const search = $derived(query.trim().toLowerCase());

    const groups = $derived(
        paletteGroups
            .map((group) => ({
                ...group,
                components: group.components.filter((type) =>
                    search.length === 0 ? true : type.toLowerCase().includes(search)
                )
            }))
            .filter((group) => group.components.length > 0)
    );
</script>

<aside class="flex min-h-0 flex-col gap-4" aria-label="Component palette">
    <div class="flex flex-col gap-1.5">
        <label class="text-[13px] font-semibold text-ink" for="palette-search"
            >{m.editor_palette()}</label
        >
        <input
            id="palette-search"
            type="search"
            bind:value={query}
            placeholder={m.editor_search_components()}
            class="h-10 w-full rounded-sm border-[1.5px] border-line bg-paper-2 px-3 text-small text-ink placeholder:text-muted/70 focus:border-brand focus:ring-3 focus:ring-brand/20 focus:outline-none"
        />
    </div>

    <p class="text-micro text-muted">{m.editor_palette_hint()}</p>

    <div class="flex flex-col gap-5 overflow-y-auto pr-1">
        {#each groups as group (group.id)}
            <section class="flex flex-col gap-1.5">
                <h2 class="text-micro font-semibold tracking-[0.08em] text-muted uppercase">
                    {group.label}
                </h2>
                {#each group.components as type (type)}
                    {@const allowed = canAdd(type, inputs)}
                    <button
                        type="button"
                        class="flex flex-col items-start gap-0.5 rounded-sm border border-transparent px-2 py-1.5 text-left transition-colors hover:border-line hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={!allowed}
                        title={allowed
                            ? `Add ${type}`
                            : `Add a matching input before using ${type}`}
                        onclick={() => onadd(type)}
                    >
                        <span class="text-small font-semibold text-ink">{type}</span>
                        <span class="text-micro text-muted">
                            {allowed
                                ? componentSummary(type, componentCatalog[type])
                                : "Needs a matching input"}
                        </span>
                    </button>
                {/each}
            </section>
        {:else}
            <p class="text-small text-muted">{m.editor_search_empty({ query })}</p>
        {/each}
    </div>
</aside>
