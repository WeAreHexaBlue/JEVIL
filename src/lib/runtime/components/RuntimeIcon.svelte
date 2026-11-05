<script lang="ts">
    import type { IconName } from "../catalog";
    import { cn } from "#lib/utils/cn";

    let {
        name,
        size = 20,
        color,
        label,
        class: className = ""
    }: { name: IconName; size?: number; color?: string; label?: string; class?: string } = $props();

    const paths: Record<IconName, string> = {
        spark: "M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z",
        palette:
            "M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a2 2 0 0 1 0-4h4a4 4 0 0 0 0-8h-5Zm-4.5 6h.01M9 6.5h.01M14 17h.01M17 17h.01",
        "arrow-right": "M4 12h15m-6-6 6 6-6 6",
        check: "m5 13 4 4L19 7",
        x: "m6 6 12 12M18 6 6 18",
        plus: "M12 5v14M5 12h14",
        minus: "M5 12h14",
        play: "M8 5.5v13l11-6.5-11-6.5Z",
        reset: "M4 10a8 8 0 1 1 2.34 6M4 4v6h6",
        copy: "M9 9h11v11H9V9ZM4 15V4h11",
        link: "M10.5 13.5a4 4 0 0 0 5.66 0l2.3-2.3a4 4 0 0 0-5.66-5.66l-1.3 1.3M13.5 10.5a4 4 0 0 0-5.66 0l-2.3 2.3a4 4 0 0 0 5.66 5.66l1.3-1.3",
        info: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-9v5m0-8.5v.5",
        warning:
            "M12 8v5m0 3.5v.5M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
        shuffle: "M3 7h3l9 10h3m0 0 2-2m-2 2 2 2M3 17h3l2-2.2M14 8.5 16 7h3m0 0-2-2m2 2-2 2"
    };
</script>

<svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    class={cn("shrink-0", className)}
    fill="none"
    stroke={color ?? "currentColor"}
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    role={label ? "img" : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : "true"}
>
    <path d={paths[name]} />
</svg>
