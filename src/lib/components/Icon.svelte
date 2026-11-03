<script lang="ts">
    import { cn } from "#lib/utils/cn";

    type IconName =
        | "arrow-right"
        | "arrow-up-right"
        | "menu"
        | "close"
        | "github"
        | "google"
        | "check"
        | "alert"
        | "mail"
        | "chevron-down"
        | "palette"
        | "dice"
        | "scale"
        | "search"
        | "sun"
        | "moon"
        | "monitor";

    const paths: Record<IconName, string> = {
        "arrow-right": "M4 12h15m-6-6 6 6-6 6",
        "arrow-up-right": "M7 17 17 7M9 7h8v8",
        menu: "M4 7h16M4 12h16M4 17h16",
        close: "m6 6 12 12M18 6 6 18",
        check: "m5 13 4 4L19 7",
        alert: "M12 8v5m0 3.5v.5M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
        mail: "M3 6h18v12H3zM3.5 6.5 12 13l8.5-6.5",
        "chevron-down": "m6 9 6 6 6-6",
        palette:
            "M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a2 2 0 0 1 0-4h4a4 4 0 0 0 0-8h-5Zm-4.5 6h.01M9 6.5h.01M14 17h.01M17 17h.01",
        dice: "M5 5h14v14H5zM9 9h.01M15 9h.01M9 15h.01M15 15h.01M12 12h.01",
        scale: "M12 4v16M6 8h12M6 8l-3 6a3 3 0 0 0 6 0L6 8Zm12 0-3 6a3 3 0 0 0 6 0l-3-6Z",
        search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
        sun: "M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
        moon: "M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z",
        monitor: "M3 5h18v11H3zM8 20h8M12 16v4",
        // Brand marks are drawn separately below; these entries only satisfy the map type.
        github: "",
        google: ""
    };

    let {
        name,
        size = 20,
        class: className = "",
        label
    }: { name: IconName; size?: number; class?: string; label?: string } = $props();
</script>

{#if name === "github"}
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        class={cn("shrink-0", className)}
        fill="currentColor"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : "true"}
    >
        <path
            d="M12 .5a11.5 11.5 0 0 0-3.64 22.42c.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .3.2.66.8.55A11.5 11.5 0 0 0 12 .5Z"
        />
    </svg>
{:else if name === "google"}
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        class={cn("shrink-0", className)}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : "true"}
    >
        <path
            fill="#4285F4"
            d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.39 3.6v3h3.86c2.26-2.08 3.58-5.15 3.58-8.79Z"
        />
        <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.86-3a7.2 7.2 0 0 1-4.08 1.15 7.19 7.19 0 0 1-6.76-4.97H1.26v3.1A12 12 0 0 0 12 24Z"
        />
        <path
            fill="#FBBC05"
            d="M5.24 14.26a7.2 7.2 0 0 1 0-4.52v-3.1H1.26a12 12 0 0 0 0 10.72l3.98-3.1Z"
        />
        <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 1.26 6.64l3.98 3.1A7.19 7.19 0 0 1 12 4.75Z"
        />
    </svg>
{:else}
    <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        class={cn("shrink-0", className)}
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : "true"}
    >
        <path d={paths[name]} />
    </svg>
{/if}
