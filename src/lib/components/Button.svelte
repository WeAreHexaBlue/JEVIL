<script lang="ts">
    import type { Snippet } from "svelte";
    import { cn } from "#lib/utils/cn";

    type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink";
    type Size = "md" | "lg";

    let {
        variant = "primary",
        size = "md",
        href,
        type = "button",
        disabled = false,
        loading = false,
        fullWidth = false,
        class: className = "",
        children,
        ...rest
    }: {
        variant?: Variant;
        size?: Size;
        href?: string;
        type?: "button" | "submit" | "reset";
        disabled?: boolean;
        loading?: boolean;
        fullWidth?: boolean;
        class?: string;
        children: Snippet;
        [key: string]: unknown;
    } = $props();

    const base =
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-spring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40";

    const sizes: Record<Size, string> = {
        md: "min-h-11 px-5 text-[0.9375rem]",
        lg: "min-h-12 px-6 text-base"
    };

    const variants: Record<Variant, string> = {
        primary: "bg-brand text-on-brand hover:bg-brand-strong",
        secondary: "border-[1.5px] border-ink bg-paper text-ink hover:bg-paper-2",
        ghost: "text-ink hover:bg-paper-2",
        danger: "bg-red text-paper hover:opacity-90",
        ink: "bg-ink text-paper hover:bg-ink-2"
    };

    const classes = $derived(
        cn(base, sizes[size], variants[variant], fullWidth && "w-full", className)
    );
</script>

{#if href && !disabled}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass paths from resolve() -->
    <a {href} class={classes} {...rest}>
        {@render children()}
    </a>
{:else}
    <button {type} {disabled} aria-busy={loading || undefined} class={classes} {...rest}>
        {@render children()}
        {#if loading}
            <span class="flex items-center gap-1" aria-hidden="true">
                <span class="size-1 animate-pulse rounded-full bg-current"></span>
                <span class="size-1 animate-pulse rounded-full bg-current [animation-delay:150ms]"
                ></span>
                <span class="size-1 animate-pulse rounded-full bg-current [animation-delay:300ms]"
                ></span>
            </span>
        {/if}
    </button>
{/if}
