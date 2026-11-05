/**
 * Literal Tailwind classes for runtime props.
 *
 * Tailwind scans source text, so classes built with template strings never
 * reach the stylesheet. These maps spell every option out and the renderer
 * indexes them; adding a range means adding entries here as well as in the
 * catalog.
 */

export const gapClasses = [
    "gap-0",
    "gap-1",
    "gap-2",
    "gap-3",
    "gap-4",
    "gap-5",
    "gap-6",
    "gap-7",
    "gap-8",
    "gap-9",
    "gap-10",
    "gap-11",
    "gap-12"
] as const;

export const paddingClasses = [
    "p-0",
    "p-1",
    "p-2",
    "p-3",
    "p-4",
    "p-5",
    "p-6",
    "p-7",
    "p-8"
] as const;

export const columnClasses = [
    "grid-cols-1",
    "grid-cols-2",
    "grid-cols-3",
    "grid-cols-4",
    "grid-cols-5",
    "grid-cols-6"
] as const;

export const spacerClasses: Record<number, string> = {
    0: "h-0",
    1: "h-1",
    2: "h-2",
    3: "h-3",
    4: "h-4",
    5: "h-5",
    6: "h-6",
    7: "h-7",
    8: "h-8",
    9: "h-9",
    10: "h-10",
    11: "h-11",
    12: "h-12",
    13: "h-13",
    14: "h-14",
    15: "h-15",
    16: "h-16"
};

export const stackAlign: Record<string, string> = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch"
};

export const stackJustify: Record<string, string> = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between"
};

export const cardTones: Record<string, string> = {
    paper: "border-line bg-paper text-ink",
    tint: "border-brand/25 bg-brand-soft text-ink",
    ink: "border-ink bg-ink text-paper"
};

export const cardRadius: Record<string, string> = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg"
};

export const textSizes: Record<string, string> = {
    sm: "text-small",
    md: "text-body",
    lg: "text-body-lg"
};

export const textTones: Record<string, string> = {
    default: "text-ink",
    muted: "text-ink-2",
    accent: "text-brand"
};

export const alignClasses: Record<string, string> = {
    start: "text-left",
    center: "text-center"
};

export const badgeTones: Record<string, string> = {
    neutral: "border-line bg-paper-2 text-ink-2",
    blue: "border-brand/40 bg-brand-soft text-brand",
    pink: "border-pink/50 bg-pink/15 text-ink",
    lime: "border-lime/70 bg-lime/25 text-ink",
    tangerine: "border-gold/70 bg-gold/30 text-ink",
    violet: "border-brand/30 bg-brand-soft text-brand",
    sky: "border-brand/20 bg-brand-soft text-brand"
};

export const meterTones: Record<string, string> = {
    neutral: "accent-ink",
    blue: "accent-brand",
    pink: "accent-pink",
    lime: "accent-lime",
    tangerine: "accent-gold",
    violet: "accent-brand",
    sky: "accent-brand"
};

export const paletteSizes: Record<string, string> = {
    sm: "h-8",
    md: "h-12",
    lg: "h-20"
};

export const headingClasses: Record<number, string> = {
    1: "text-h1",
    2: "text-h2",
    3: "text-h3",
    4: "text-h4"
};

export const buttonIconSizes: Record<string, number> = {
    md: 20,
    lg: 22
};

/** Index a class map without risking `undefined` in the markup. */
export const pick = (map: Record<string, string>, key: unknown, fallback: string): string =>
    typeof key === "string" && key in map ? map[key]! : fallback;

export const pickIndex = (list: readonly string[], value: unknown, fallbackIndex = 0): string => {
    const index =
        typeof value === "number" && Number.isInteger(value)
            ? Math.min(list.length - 1, Math.max(0, value))
            : fallbackIndex;
    return list[index] ?? list[fallbackIndex] ?? "";
};
