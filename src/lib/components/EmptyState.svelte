<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "#lib/utils/cn";

    let {
        title,
        body,
        class: className = "",
        children
    }: { title: string; body: string; class?: string; children?: Snippet } = $props();
</script>

<div
    class={cn(
        "flex flex-col items-center gap-6 text-center sm:items-start sm:text-left",
        className
    )}
>
    <svg viewBox="0 0 120 72" class="h-16 w-28" aria-hidden="true">
        <circle cx="28" cy="36" r="18" fill="var(--brand)" opacity="0.2" />
        <rect
            x="46"
            y="18"
            width="36"
            height="36"
            rx="10"
            fill="var(--color-lime)"
            opacity="0.55"
        />
        <path d="M96 18 114 54H78Z" fill="var(--color-gold)" opacity="0.65" />
    </svg>
    <div class="max-w-md">
        <h3 class="text-h3 text-ink">{title}</h3>
        <p class="mt-2 text-body text-ink-2">{body}</p>
    </div>
    {#if children}
        <div>{@render children()}</div>
    {/if}
</div>
