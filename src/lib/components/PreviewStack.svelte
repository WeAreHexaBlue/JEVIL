<script lang="ts">
    import { m } from "#lib/paraglide/messages";

    const swatches = [
        { hex: "#F7F4FF", ink: "#171123" },
        { hex: "#5B21B6", ink: "#FFFFFF" },
        { hex: "#8B5CF6", ink: "#FFFFFF" },
        { hex: "#B9F24D", ink: "#15220A" },
        { hex: "#FFD93D", ink: "#241A00" }
    ];

    const circumference = 2 * Math.PI * 38;
    const score = 0.71;
    const dashOffset = circumference * (1 - score);
</script>

<div class="relative mx-auto h-[340px] w-full max-w-[460px] select-none" aria-hidden="true">
    <!-- Palette card -->
    <div
        class="absolute top-4 left-0 w-[270px] -rotate-2 rounded-lg border border-line bg-paper p-5 shadow-soft"
    >
        <div class="flex items-start justify-between gap-3">
            <div>
                <p class="font-display text-h4 font-bold tracking-[-0.02em]">Palette Oracle</p>
                <p class="mt-0.5 font-mono text-[11px] text-muted">{m.hero_sample()}</p>
            </div>
            <span
                class="inline-flex items-center gap-1.5 rounded-full bg-paper-3 px-2.5 py-1 text-[11px] font-semibold text-ink-2"
            >
                <span class="size-1.5 rounded-full bg-brand"></span>71% sure
            </span>
        </div>
        <div class="mt-4 flex gap-1">
            {#each swatches as swatch (swatch.hex)}
                <div class="flex-1">
                    <div
                        class="h-16 rounded-[10px]"
                        style="background-color: {swatch.hex}; box-shadow: inset 0 0 0 1px rgb(22 21 15 / 0.08)"
                    ></div>
                    <p class="mt-1.5 font-mono text-[10px] tracking-tight text-muted">
                        {swatch.hex}
                    </p>
                </div>
            {/each}
        </div>
    </div>

    <!-- Score card -->
    <div
        class="absolute top-0 right-0 w-[200px] rotate-3 rounded-lg border border-line bg-paper p-5 shadow-soft"
    >
        <p class="font-display text-h4 font-bold tracking-[-0.02em]">Vibe Check</p>
        <p class="mt-0.5 font-mono text-[11px] text-muted">{m.hero_sample()}</p>
        <div class="mt-3 flex items-center justify-center">
            <svg viewBox="0 0 96 96" class="size-24">
                <circle
                    cx="48"
                    cy="48"
                    r="38"
                    fill="none"
                    stroke="var(--color-paper-3)"
                    stroke-width="8"
                />
                <circle
                    cx="48"
                    cy="48"
                    r="38"
                    fill="none"
                    stroke="var(--green)"
                    stroke-width="8"
                    stroke-linecap="round"
                    stroke-dasharray={circumference}
                    stroke-dashoffset={dashOffset}
                    transform="rotate(-90 48 48)"
                />
                <text
                    x="48"
                    y="53"
                    text-anchor="middle"
                    font-family="var(--font-display)"
                    font-size="22"
                    font-weight="700"
                    fill="var(--color-ink)">71</text
                >
            </svg>
        </div>
    </div>

    <!-- Yes/no card -->
    <div
        class="absolute top-[210px] left-1/2 w-[250px] -translate-x-1/2 rotate-1 rounded-lg border-[1.5px] border-ink bg-paper p-5 shadow-lift"
    >
        <p class="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
            Should I ship it?
        </p>
        <div class="mt-3 flex items-center gap-3">
            <span class="grid size-10 place-items-center rounded-full bg-lime text-on-lime">
                <svg
                    viewBox="0 0 24 24"
                    class="size-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="m5 13 4 4L19 7" />
                </svg>
            </span>
            <div>
                <p class="font-display text-h3 font-bold tracking-[-0.02em]">Yes</p>
                <p class="font-mono text-[11px] text-muted">83% sure</p>
            </div>
        </div>
    </div>
</div>
