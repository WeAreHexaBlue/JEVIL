/**
 * Deterministic SVG scenes for the `Canvas` component (APP-FORMAT §8.1).
 *
 * A canvas is art, not data: the same seed must always draw the same shapes,
 * on the server and in the browser. Everything is seeded by the caller (the
 * runtime passes the input hash), never by `Math.random()`, and every number
 * is clamped so a bad prop cannot produce an offscreen or infinite shape.
 *
 * The output is plain primitives, which gives the renderer two useful
 * properties: no `<canvas>` pixel readback, and no inline CSS from a
 * blueprint. Colors come from the validated `color[]` prop.
 */

import { seededRandom } from "./bindings";

export const CANVAS_WIDTH = 320;
export const CANVAS_MIN_HEIGHT = 120;
export const CANVAS_MAX_HEIGHT = 480;

export type PaintPreset = "palette-field" | "stripes" | "grain" | "orb";

export interface SceneRect {
    kind: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    rx?: number;
    fill: string;
    opacity?: number;
}

export interface SceneCircle {
    kind: "circle";
    cx: number;
    cy: number;
    r: number;
    fill: string;
    opacity?: number;
}

export interface SceneLine {
    kind: "line";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stroke: string;
    strokeWidth: number;
    opacity?: number;
}

export interface ScenePath {
    kind: "path";
    d: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
}

export type SceneElement = SceneRect | SceneCircle | SceneLine | ScenePath;

export interface CanvasScene {
    width: number;
    height: number;
    background: string;
    elements: SceneElement[];
}

export interface CanvasOptions {
    paint: PaintPreset;
    height: number;
    colors?: string[];
    energy?: number;
    seed?: string;
    background?: string;
}

export const DEFAULT_PALETTE = ["#5b21b6", "#b9f24d", "#ef5da8", "#ffd93d", "#7c3aed"] as const;
export const DEFAULT_BACKGROUND = "#171022";

const clamp = (value: number, min: number, max: number): number =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

const hex = (value: unknown): string | undefined =>
    typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : undefined;

const paletteOf = (colors: string[] | undefined): string[] => {
    const valid = (colors ?? []).map(hex).filter((color): color is string => Boolean(color));
    return valid.length >= 2 ? valid : [...DEFAULT_PALETTE];
};

const colorAt = (colors: string[], index: number): string => colors[index % colors.length]!;

const round = (value: number): number => Math.round(value * 10) / 10;

/* -------------------------------------------------------------------------- */
/* Presets                                                                    */
/* -------------------------------------------------------------------------- */

/** Soft overlapping fields of color. Energy packs more, smaller fields. */
const paletteField = (
    palette: string[],
    height: number,
    energy: number,
    random: () => number
): SceneElement[] => {
    const elements: SceneElement[] = [];
    const count = 4 + Math.round(energy * 6);

    for (let index = 0; index < count; index += 1) {
        const radius = 90 + random() * 90 - energy * 30;
        elements.push({
            kind: "circle",
            cx: round(random() * CANVAS_WIDTH),
            cy: round(random() * height),
            r: round(Math.max(20, radius)),
            fill: colorAt(palette, index),
            opacity: round(0.45 + random() * 0.35)
        });
    }

    elements.push({
        kind: "rect",
        x: 0,
        y: 0,
        width: CANVAS_WIDTH,
        height,
        fill: palette[0]!,
        opacity: 0.08
    });

    return elements;
};

/** Diagonal bands; energy changes the band count and width. */
const stripes = (
    palette: string[],
    height: number,
    energy: number,
    random: () => number
): SceneElement[] => {
    const elements: SceneElement[] = [];
    const count = 7 + Math.round(energy * 9);
    const step = (CANVAS_WIDTH + height) / count;

    for (let index = 0; index < count; index += 1) {
        const x = -height + index * step;
        elements.push({
            kind: "line",
            x1: round(x),
            y1: round(height + random() * 8),
            x2: round(x + height),
            y2: round(-random() * 8),
            stroke: colorAt(palette, index),
            strokeWidth: round(step * (0.35 + random() * 0.4)),
            opacity: round(0.5 + random() * 0.4)
        });
    }

    return elements;
};

/** Speckled paper. Energy sets density, not position. */
const grain = (
    palette: string[],
    height: number,
    energy: number,
    random: () => number
): SceneElement[] => {
    const elements: SceneElement[] = [];
    const count = 120 + Math.round(energy * 320);

    for (let index = 0; index < count; index += 1) {
        elements.push({
            kind: "circle",
            cx: round(random() * CANVAS_WIDTH),
            cy: round(random() * height),
            r: round(0.5 + random() * 1.4),
            fill: colorAt(palette, index),
            opacity: round(0.2 + random() * 0.55)
        });
    }

    return elements;
};

/** A lit sphere: nested discs plus a highlight. */
const orb = (
    palette: string[],
    height: number,
    energy: number,
    random: () => number
): SceneElement[] => {
    const elements: SceneElement[] = [];
    const centerX = CANVAS_WIDTH / 2 + (random() - 0.5) * 20;
    const centerY = height / 2 + (random() - 0.5) * 12;
    const maxRadius = Math.min(CANVAS_WIDTH, height) * (0.3 + energy * 0.16);
    const rings = 7;

    for (let index = rings - 1; index >= 0; index -= 1) {
        elements.push({
            kind: "circle",
            cx: round(centerX),
            cy: round(centerY),
            r: round((maxRadius * (index + 1)) / rings),
            fill: colorAt(palette, index + 1),
            opacity: round(0.55 - index * 0.045)
        });
    }

    elements.push({
        kind: "circle",
        cx: round(centerX - maxRadius * 0.28),
        cy: round(centerY - maxRadius * 0.3),
        r: round(maxRadius * 0.22),
        fill: palette[1] ?? "#ffffff",
        opacity: 0.55
    });

    return elements;
};

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

export const canvasScene = ({
    paint,
    height,
    colors,
    energy = 0.5,
    seed = "canvas",
    background
}: CanvasOptions): CanvasScene => {
    const palette = paletteOf(colors);
    const safeHeight = clamp(Math.round(height), CANVAS_MIN_HEIGHT, CANVAS_MAX_HEIGHT);
    const safeEnergy = clamp(energy, 0, 1);
    const random = seededRandom(`${seed}:${paint}:${safeEnergy}`);

    const elements =
        paint === "stripes"
            ? stripes(palette, safeHeight, safeEnergy, random)
            : paint === "grain"
              ? grain(palette, safeHeight, safeEnergy, random)
              : paint === "orb"
                ? orb(palette, safeHeight, safeEnergy, random)
                : paletteField(palette, safeHeight, safeEnergy, random);

    return {
        width: CANVAS_WIDTH,
        height: safeHeight,
        background: hex(background) ?? DEFAULT_BACKGROUND,
        elements
    };
};

/** A stable, human-readable label for the SVG's accessible name. */
export const paintLabel = (paint: PaintPreset): string =>
    paint === "palette-field"
        ? "Generated color field"
        : paint === "stripes"
          ? "Generated stripe pattern"
          : paint === "grain"
            ? "Generated grain texture"
            : "Generated orb";
