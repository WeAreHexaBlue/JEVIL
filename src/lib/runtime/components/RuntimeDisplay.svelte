<script lang="ts">
    import type { PaintPreset } from "../canvas";
    import type { IconName } from "../catalog";
    import type { ResolvedNode } from "../render-model";
    import { textValue } from "../render-model";
    import {
        alignClasses,
        badgeTones,
        headingClasses,
        meterTones,
        paletteSizes,
        pick,
        textSizes,
        textTones
    } from "./classes";
    import RuntimeCanvas from "./RuntimeCanvas.svelte";
    import RuntimeIcon from "./RuntimeIcon.svelte";
    import { cn } from "#lib/utils/cn";

    let { node }: { node: ResolvedNode } = $props();

    const bounded = (value: unknown, fallback: number): number =>
        typeof value === "number" && Number.isFinite(value) ? value : fallback;

    const clamp01 = (value: unknown): number => Math.min(1, Math.max(0, bounded(value, 0)));
    const percent = (value: number): string => `${Math.round(value * 100)}%`;
    const align = (value: unknown): string => pick(alignClasses, value, "");

    const level = $derived(
        typeof node.props.level === "number" ? Math.min(4, Math.max(1, node.props.level)) : 2
    );
    const colors = $derived(
        Array.isArray(node.props.colors)
            ? node.props.colors.filter((color): color is string => typeof color === "string")
            : []
    );
    const items = $derived(
        Array.isArray(node.props.items) ? node.props.items.map((item) => textValue(item)) : []
    );
    const unit = $derived(clamp01(node.props.value));
    const label = $derived(textValue(node.props.label));
    const probabilities = $derived.by(() => {
        const record = node.props.probabilities;
        if (record === null || typeof record !== "object" || Array.isArray(record)) return [];
        return Object.entries(record as Record<string, unknown>)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number")
            .sort((left, right) => right[1] - left[1])
            .slice(0, 12);
    });
    const dialRadius = 52;
    const dialCircumference = 2 * Math.PI * dialRadius;
</script>

{#if node.type === "Heading"}
    <svelte:element
        this={`h${level}`}
        class={cn(headingClasses[level], align(node.props.align), "font-display text-ink")}
    >
        {textValue(node.props.text)}
    </svelte:element>
{:else if node.type === "Text"}
    <p
        class={cn(
            textSizes[node.props.size as string] ?? textSizes.md,
            textTones[node.props.tone as string] ?? textTones.default,
            align(node.props.align)
        )}
    >
        {textValue(node.props.text)}
    </p>
{:else if node.type === "Badge"}
    <span
        class={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-micro font-semibold tracking-[0.04em] uppercase",
            pick(badgeTones, node.props.tone, badgeTones.neutral)
        )}
    >
        {textValue(node.props.text)}
    </span>
{:else if node.type === "Stat"}
    <div class="flex flex-col gap-1">
        <span class="text-micro font-semibold tracking-[0.08em] text-ink-2 uppercase">
            {textValue(node.props.label)}
        </span>
        <span class="font-display text-h3 text-ink">{textValue(node.props.value)}</span>
        {#if node.props.hint}
            <span class="text-small text-ink-2">{textValue(node.props.hint)}</span>
        {/if}
    </div>
{:else if node.type === "Meter"}
    <div class="flex flex-col gap-1.5">
        <div class="flex items-baseline justify-between gap-3">
            {#if label}<span class="text-small font-semibold text-ink">{label}</span>{/if}
            <span class="font-mono text-micro text-ink-2">{percent(unit)}</span>
        </div>
        <progress
            class={cn("h-2.5 w-full", pick(meterTones, node.props.tone, meterTones.neutral))}
            max="1"
            value={unit}
        ></progress>
    </div>
{:else if node.type === "ScoreDial"}
    <figure class="flex flex-col items-center gap-2">
        <svg
            viewBox="0 0 120 120"
            class="size-[120px]"
            role="img"
            aria-label={`${label}: ${percent(unit)}`}
        >
            <circle
                cx="60"
                cy="60"
                r={dialRadius}
                fill="none"
                stroke="var(--paper-3)"
                stroke-width="10"
            />
            <circle
                cx="60"
                cy="60"
                r={dialRadius}
                fill="none"
                stroke="var(--brand)"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray={dialCircumference}
                stroke-dashoffset={dialCircumference * (1 - unit)}
                transform="rotate(-90 60 60)"
            />
            <text
                x="60"
                y="62"
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-ink font-display text-[28px] font-bold"
            >
                {percent(unit)}
            </text>
        </svg>
        {#if label}<figcaption class="text-small text-ink-2">{label}</figcaption>{/if}
        {#if Array.isArray(node.props.levels)}
            <div class="flex w-full max-w-[220px] justify-between text-micro text-muted">
                <span>{textValue(node.props.levels[0])}</span>
                <span>{textValue(node.props.levels.at(-1))}</span>
            </div>
        {/if}
    </figure>
{:else if node.type === "ProbabilityBars"}
    <div class="flex flex-col gap-2">
        {#if label}
            <span class="text-small font-semibold text-ink">{label}</span>
        {/if}
        {#each probabilities as [key, probability], index (key)}
            {@const isWinner = node.props.highlight === key || index === 0}
            <div class="grid grid-cols-[88px_1fr_44px] items-center gap-2">
                <span
                    class={cn(
                        "truncate text-small",
                        isWinner ? "font-semibold text-ink" : "text-ink-2"
                    )}
                >
                    {key}
                </span>
                <progress
                    class={cn("h-2 w-full", isWinner ? "accent-ink" : "accent-brand")}
                    max="1"
                    value={clamp01(probability)}
                ></progress>
                <span class="text-right font-mono text-micro text-ink-2">
                    {percent(clamp01(probability))}
                </span>
            </div>
        {/each}
    </div>
{:else if node.type === "Palette"}
    <div class="flex flex-wrap gap-2">
        {#each colors as color (color)}
            <div class="flex min-w-14 flex-1 flex-col gap-1.5">
                <svg
                    viewBox="0 0 100 60"
                    class={cn(
                        "block w-full rounded-sm border border-black/10",
                        paletteSizes[node.props.size as string] ?? paletteSizes.md
                    )}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <rect x="0" y="0" width="100" height="60" fill={color} />
                </svg>
                {#if node.props.labels}
                    <span class="text-center font-mono text-micro text-ink-2">{color}</span>
                {/if}
            </div>
        {/each}
    </div>
{:else if node.type === "Canvas"}
    <div class="overflow-hidden rounded-sm border border-line">
        <RuntimeCanvas
            paint={(node.props.paint as PaintPreset) ?? "palette-field"}
            height={bounded(node.props.height, 240)}
            {colors}
            energy={bounded(node.props.energy, 0.5)}
            seed={typeof node.props.seed === "string" ? node.props.seed : undefined}
            background={typeof node.props.background === "string"
                ? node.props.background
                : undefined}
        />
    </div>
{:else if node.type === "Shape"}
    {@const size = Math.min(240, Math.max(24, bounded(node.props.size, 96)))}
    {@const color = typeof node.props.color === "string" ? node.props.color : "var(--brand)"}
    {@const rotate = Math.min(180, Math.max(-180, bounded(node.props.rotate, 0)))}
    <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={`${node.props.kind} shape`}
        transform={`rotate(${rotate} 50 50)`}
    >
        {#if node.props.kind === "ring"}
            <circle cx="50" cy="50" r="38" fill="none" stroke={color} stroke-width="12" />
        {:else if node.props.kind === "star"}
            <path d="M50 5 63 35 95 38 71 60 78 92 50 75 22 92 29 60 5 38 37 35Z" fill={color} />
        {:else if node.props.kind === "squiggle"}
            <path
                d="M8 60C20 30 32 90 44 60S68 90 80 60s12-20 12-20"
                fill="none"
                stroke={color}
                stroke-width="10"
                stroke-linecap="round"
            />
        {:else}
            <path
                d="M50 6c20 0 30 12 40 22s8 28-2 38-24 22-38 20-30-8-36-22-6-30 4-40S34 6 50 6Z"
                fill={color}
            />
        {/if}
    </svg>
{:else if node.type === "List"}
    {@const ordered = node.props.ordered === true || node.props.marker === "number"}
    {@const tag = ordered ? "ol" : "ul"}
    {@const markerClass =
        node.props.marker === "none" ? "list-none" : ordered ? "list-decimal" : "list-disc"}
    <svelte:element
        this={tag}
        class={cn("ml-5 flex flex-col gap-1.5 text-body text-ink", markerClass)}
    >
        {#each items as item, index (`${index}-${item}`)}
            <li>{item}</li>
        {/each}
    </svelte:element>
{:else if node.type === "Icon"}
    <RuntimeIcon
        name={(node.props.name as IconName) ?? "spark"}
        size={Math.min(48, Math.max(16, bounded(node.props.size, 20)))}
        color={typeof node.props.color === "string" ? node.props.color : undefined}
    />
{:else if node.type === "ConfidenceChip"}
    <span
        class="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand-soft px-3 py-1 text-micro font-semibold text-brand"
    >
        {#if label}<span>{label}</span>{/if}
        <span class="font-mono">{percent(unit)}</span>
    </span>
{:else if node.type === "Skeleton"}
    <div
        class={cn(
            "animate-pulse rounded-sm bg-paper-3",
            node.props.width === "half" ? "w-1/2" : "w-full"
        )}
        style:height={`${Math.min(240, Math.max(8, bounded(node.props.height, 48)))}px`}
        aria-hidden="true"
    ></div>
{:else if node.type === "ErrorNote"}
    <div class="flex gap-3 rounded-sm border-[1.5px] border-red/40 bg-red/8 p-4">
        <span class="text-red"><RuntimeIcon name="warning" size={20} /></span>
        <div class="flex flex-col gap-1">
            <span class="text-small font-semibold text-ink">
                {textValue(node.props.title ?? "Something went wrong")}
            </span>
            <span class="text-small text-ink-2">{textValue(node.props.message)}</span>
        </div>
    </div>
{:else if node.type === "EmptyState"}
    <div class="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <span class="text-brand">
            <RuntimeIcon
                name={(node.props.icon as IconName) ?? "spark"}
                size={32}
                label={textValue(node.props.title)}
            />
        </span>
        <span class="font-display text-h4 text-ink">{textValue(node.props.title)}</span>
        <span class="max-w-sm text-small text-ink-2">{textValue(node.props.message)}</span>
    </div>
{/if}
