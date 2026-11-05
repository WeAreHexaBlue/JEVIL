<script lang="ts">
    import { canvasScene, paintLabel, type PaintPreset } from "../canvas";

    let {
        paint,
        height,
        colors,
        energy,
        seed,
        background
    }: {
        paint: PaintPreset;
        height: number;
        colors?: string[];
        energy?: number;
        seed?: string;
        background?: string;
    } = $props();

    const scene = $derived(canvasScene({ paint, height, colors, energy, seed, background }));
</script>

<svg
    viewBox={`0 0 ${scene.width} ${scene.height}`}
    class="block h-auto w-full"
    role="img"
    aria-label={paintLabel(paint)}
    preserveAspectRatio="xMidYMid slice"
>
    <rect x="0" y="0" width={scene.width} height={scene.height} fill={scene.background} />
    {#each scene.elements as element, index (index)}
        {#if element.kind === "rect"}
            <rect
                x={element.x}
                y={element.y}
                width={element.width}
                height={element.height}
                rx={element.rx ?? 0}
                fill={element.fill}
                opacity={element.opacity ?? 1}
            />
        {:else if element.kind === "circle"}
            <circle
                cx={element.cx}
                cy={element.cy}
                r={element.r}
                fill={element.fill}
                opacity={element.opacity ?? 1}
            />
        {:else if element.kind === "line"}
            <line
                x1={element.x1}
                y1={element.y1}
                x2={element.x2}
                y2={element.y2}
                stroke={element.stroke}
                stroke-width={element.strokeWidth}
                stroke-linecap="round"
                opacity={element.opacity ?? 1}
            />
        {:else}
            <path
                d={element.d}
                fill={element.fill ?? "none"}
                stroke={element.stroke ?? "none"}
                stroke-width={element.strokeWidth ?? 0}
                opacity={element.opacity ?? 1}
            />
        {/if}
    {/each}
</svg>
