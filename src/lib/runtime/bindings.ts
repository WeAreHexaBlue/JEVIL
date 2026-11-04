/**
 * Runtime binding, transform, and builtin evaluation (APP-FORMAT §7, §10.2–§10.3).
 *
 * Client-safe and deterministic: no `eval`, no `Math.random()`, no network, and
 * no secrets. Every lookup is a known path or an allowlisted pure function.
 * Missing answers and bad types fall back to a declared fallback or a
 * type-appropriate zero, and are reported as warnings, never thrown.
 */

import type { Answer } from "#lib/decide/types";
import type { AppMeta, Binding, BuiltinName, Transform, VarDef } from "#lib/schema/blueprint";
import { varDependencies } from "./dependencies";

export type InputValue = string | number | boolean;

export interface RuntimeScope {
    inputs: Record<string, InputValue>;
    answers: Record<string, Record<string, Answer>>;
    vars?: Record<string, unknown>;
    meta: AppMeta;
    /** Overrides the input hash for `palette` / `pick`. */
    seed?: string | number;
}

export interface EvaluatedVars {
    values: Record<string, unknown>;
    warnings: string[];
}

export interface EvaluatedVar {
    value: unknown;
    warnings: string[];
}

/* -------------------------------------------------------------------------- */
/* Values                                                                     */
/* -------------------------------------------------------------------------- */

const isPrimitive = (value: unknown): value is string | number | boolean =>
    typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/** Text for a template. Objects are JSON rather than `[object Object]`. */
export const textOf = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
    if (typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value) ?? "";
    } catch {
        return "";
    }
};

const isEmpty = (value: unknown): boolean =>
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "number" && Number.isNaN(value));

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

const answerField = (answer: Answer | undefined, field: string): unknown => {
    if (!answer) return undefined;

    switch (field) {
        case "answer":
            return answer;
        case "confidence":
            return answer.type === "noul" ? undefined : answer.confidence;
        case "probabilities":
            return answer.type === "noul" ? undefined : answer.probabilities;
        case "choice":
            return answer.type === "choice" ? answer.choice : undefined;
        case "score":
            return answer.type === "score" ? answer.score : undefined;
        case "noul":
            return answer.type === "noul" ? answer.noul : undefined;
        case "value":
            if (answer.type === "choice") return answer.choice;
            if (answer.type === "score") return answer.score;
            return answer.noul;
        default:
            return undefined;
    }
};

/** Resolve a dotted path from a template or a `{ var }` binding. */
export const resolvePath = (path: string, scope: RuntimeScope): unknown => {
    const parts = path.split(".");
    const [root, ...rest] = parts;

    if (root === "inputs") return rest.length === 1 ? scope.inputs[rest[0]!] : undefined;
    if (root === "vars") return rest.length === 1 ? scope.vars?.[rest[0]!] : undefined;
    if (root === "meta") {
        if (rest.length !== 1) return undefined;
        const field = rest[0]!;
        if (
            field === "title" ||
            field === "tagline" ||
            field === "description" ||
            field === "accent" ||
            field === "icon" ||
            field === "autorun"
        ) {
            return scope.meta[field];
        }
        return undefined;
    }
    if (root === "steps") {
        if (rest.length !== 2 && rest.length !== 3) return undefined;
        const [stepId, questionId, field = "value"] = rest;
        return answerField(scope.answers[stepId!]?.[questionId!], field);
    }

    return undefined;
};

export const resolveTemplate = (template: string, scope: RuntimeScope): string => {
    const marker = "\u0000";
    const escaped = template.replaceAll("\\{{", marker);

    const interpolated = escaped.replace(/\{\{([^{}]*)\}\}/g, (_match, raw: string) =>
        textOf(resolvePath(raw.trim(), scope))
    );

    return interpolated.replaceAll(marker, "{{");
};

/** Resolve any binding kind. Missing values are `undefined`, never a throw. */
export const resolveBinding = (binding: Binding, scope: RuntimeScope): unknown => {
    if ("lit" in binding) return binding.lit;
    if ("template" in binding) return resolveTemplate(binding.template, scope);
    if ("var" in binding) {
        return binding.var.includes(".")
            ? resolvePath(binding.var, scope)
            : scope.vars?.[binding.var];
    }

    return answerField(scope.answers[binding.step]?.[binding.question], binding.pick ?? "value");
};

/* -------------------------------------------------------------------------- */
/* Seeded randomness                                                          */
/* -------------------------------------------------------------------------- */

/** FNV-1a, stable across platforms. */
export const hashString = (value: string): number => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

/** Deterministic jitter in [-amount, amount], seeded by `hash(seed + ":" + index)`. */
const jitter = (seed: string, index: number, amount: number): number => {
    const random = mulberry32(hashString(`${seed}:${index}`));
    return (random() * 2 - 1) * amount;
};

const stableValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(
            Object.keys(record)
                .sort()
                .map((key) => [key, stableValue(record[key])])
        );
    }
    return value;
};

/** The default seed: a stable JSON of the inputs (APP-FORMAT §10.3). */
export const inputSeed = (inputs: Record<string, InputValue>): string =>
    JSON.stringify(stableValue(inputs));

const scopeSeed = (scope: RuntimeScope): string => String(scope.seed ?? inputSeed(scope.inputs));

/* -------------------------------------------------------------------------- */
/* Colors                                                                     */
/* -------------------------------------------------------------------------- */

interface Rgb {
    r: number;
    g: number;
    b: number;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const toByte = (value: number): number => Math.round(clamp(value, 0, 255));

const rgbToHex = ({ r, g, b }: Rgb): string =>
    `#${[r, g, b].map((channel) => toByte(channel).toString(16).padStart(2, "0")).join("")}`;

const hslToRgb = (hue: number, saturation: number, lightness: number): Rgb => {
    const h = (((hue % 360) + 360) % 360) / 360;
    const s = clamp(saturation, 0, 100) / 100;
    const l = clamp(lightness, 0, 100) / 100;

    if (s === 0) {
        const gray = l * 255;
        return { r: gray, g: gray, b: gray };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const channel = (t: number): number => {
        let value = t;
        if (value < 0) value += 1;
        if (value > 1) value -= 1;
        if (value < 1 / 6) return p + (q - p) * 6 * value;
        if (value < 1 / 2) return q;
        if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
        return p;
    };

    return {
        r: channel(h + 1 / 3) * 255,
        g: channel(h) * 255,
        b: channel(h - 1 / 3) * 255
    };
};

const hslToHex = (hue: number, saturation: number, lightness: number): string =>
    rgbToHex(hslToRgb(hue, saturation, lightness));

/** Parse `#rgb`, `#rrggbb`, or `hsl(h, s%, l%)`. Invalid colors become black. */
const parseColor = (value: unknown): Rgb => {
    if (typeof value !== "string") return { r: 0, g: 0, b: 0 };

    const text = value.trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
        const digits = hex[1]!;
        const full =
            digits.length === 3
                ? digits
                      .split("")
                      .map((digit) => digit + digit)
                      .join("")
                : digits;
        return {
            r: parseInt(full.slice(0, 2), 16),
            g: parseInt(full.slice(2, 4), 16),
            b: parseInt(full.slice(4, 6), 16)
        };
    }

    const hsl = /^hsl\(\s*(-?[\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*\)$/i.exec(text);
    if (hsl) return hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]));

    return { r: 0, g: 0, b: 0 };
};

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
});

/** WCAG relative luminance, used only to pick readable text. */
const luminance = ({ r, g, b }: Rgb): number => {
    const channel = (value: number): number => {
        const normalized = value / 255;
        return normalized <= 0.03928
            ? normalized / 12.92
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (a: Rgb, b: Rgb): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((left, right) => right - left);
    return (light! + 0.05) / (dark! + 0.05);
};

/* -------------------------------------------------------------------------- */
/* Builtins                                                                   */
/* -------------------------------------------------------------------------- */

const HARMONY: Record<string, readonly number[]> = {
    analogous: [0, -24, 24, -12, 12],
    complementary: [0, 180, 12, 192, -12],
    triadic: [0, 120, 240, 12, 132],
    split: [0, 150, 210, -30, 30],
    monochrome: [0, 0, 0, 0, 0],
    tetradic: [0, 90, 180, 270, 45]
};

const SPREAD: Record<string, number> = {
    monochrome: 9,
    analogous: 4,
    complementary: 5,
    triadic: 6,
    split: 6,
    tetradic: 5
};

const toNumber = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

const formatNumber = (value: unknown, decimals: unknown): string => {
    const number = toNumber(value, 0);
    const places = clamp(Math.round(toNumber(decimals, 0)), 0, 4);
    const fixed = Math.abs(number).toFixed(places);
    const [integer, fraction] = fixed.split(".");
    const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const sign = number < 0 && Number(fixed) !== 0 ? "-" : "";
    return `${sign}${grouped}${fraction ? `.${fraction}` : ""}`;
};

const palette = (args: Record<string, unknown>, scope: RuntimeScope): string[] => {
    const hue = toNumber(args.hue, 0);
    const saturation = clamp(toNumber(args.saturation, 50), 8, 92);
    const lightness = clamp(toNumber(args.lightness, 50), 8, 94);
    const harmony =
        typeof args.harmony === "string" && args.harmony in HARMONY ? args.harmony : "analogous";
    const count = clamp(Math.round(toNumber(args.count, 5)), 2, 12);
    const seed = String(args.seed ?? scopeSeed(scope));
    const offsets = HARMONY[harmony]!;
    const spread = SPREAD[harmony]!;
    const colors: string[] = [];

    for (let index = 0; index < count; index += 1) {
        const h = (hue + offsets[index % 5]! + jitter(seed, index, 6) + 360) % 360;
        const s = clamp(saturation + jitter(seed, index + 11, 8), 8, 92);
        const l = clamp(
            lightness + (index - (count - 1) / 2) * spread + jitter(seed, index + 23, 4),
            8,
            94
        );
        colors.push(hslToHex(h, s, l));
    }

    return colors;
};

const callBuiltin = (
    name: BuiltinName,
    args: Record<string, unknown>,
    scope: RuntimeScope
): unknown => {
    switch (name) {
        case "hsl":
            return hslToHex(toNumber(args.h, 0), toNumber(args.s, 50), toNumber(args.l, 50));
        case "mix": {
            const t = clamp(toNumber(args.t, 0.5), 0, 1);
            return rgbToHex(mixRgb(parseColor(args.a), parseColor(args.b), t));
        }
        case "shade": {
            const amount = clamp(toNumber(args.amount, 0), -1, 1);
            const target: Rgb = amount >= 0 ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
            return rgbToHex(mixRgb(parseColor(args.color), target, Math.abs(amount)));
        }
        case "contrastText": {
            const color = parseColor(args.color);
            const dark: Rgb = { r: 0x16, g: 0x15, b: 0x0f };
            const light: Rgb = { r: 255, g: 255, b: 255 };
            return contrastRatio(color, dark) >= contrastRatio(color, light)
                ? rgbToHex(dark)
                : rgbToHex(light);
        }
        case "palette":
            return palette(args, scope);
        case "formatNumber":
            return formatNumber(args.value, args.decimals);
        case "pick": {
            const list = Array.isArray(args.list) ? args.list : [];
            if (list.length === 0) return null;
            const seed = String(args.seed ?? scopeSeed(scope));
            return list[hashString(seed) % list.length];
        }
        case "first": {
            const list = Array.isArray(args.list) ? args.list : [];
            return list.length > 0 ? list[0] : null;
        }
    }
};

/* -------------------------------------------------------------------------- */
/* Transforms                                                                 */
/* -------------------------------------------------------------------------- */

const mapRange = (
    value: number,
    input: [number, number],
    output: [number, number],
    shouldClamp: boolean
): number => {
    const [inMin, inMax] = input;
    const [outMin, outMax] = output;
    if (inMin === inMax) return outMin;

    let progress = (value - inMin) / (inMax - inMin);
    if (shouldClamp) progress = clamp(progress, 0, 1);
    return outMin + progress * (outMax - outMin);
};

const applyTransform = (value: unknown, transform: Transform, scope: RuntimeScope): unknown => {
    switch (transform.op) {
        case "lerp":
        case "mapRange": {
            if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
            return mapRange(value, transform.in, transform.out, transform.clamp ?? true);
        }
        case "clamp":
            if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
            return clamp(value, transform.min, transform.max);
        case "round": {
            if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
            const places = transform.to ?? 0;
            return Number(value.toFixed(places));
        }
        case "lookup": {
            const key = isPrimitive(value) ? String(value) : textOf(value);
            return Object.prototype.hasOwnProperty.call(transform.map, key)
                ? transform.map[key]
                : transform.default;
        }
        case "default":
            return isEmpty(value) ? transform.value : value;
        case "concat": {
            const parts: string[] = [];
            if (value !== undefined && value !== null) parts.push(textOf(value));
            for (const binding of transform.values ?? []) {
                parts.push(textOf(resolveBinding(binding, scope)));
            }
            const joined = parts.filter((part) => part.length > 0).join(transform.separator ?? "");
            return `${transform.prefix ?? ""}${joined}${transform.suffix ?? ""}`;
        }
        case "percent": {
            if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
            return `${(value * 100).toFixed(clamp(transform.decimals ?? 0, 0, 4))}%`;
        }
        case "abs":
            return typeof value === "number" && Number.isFinite(value)
                ? Math.abs(value)
                : undefined;
        case "min":
            return typeof value === "number" && Number.isFinite(value)
                ? Math.min(value, transform.value)
                : undefined;
        case "max":
            return typeof value === "number" && Number.isFinite(value)
                ? Math.max(value, transform.value)
                : undefined;
    }
};

/* -------------------------------------------------------------------------- */
/* Vars                                                                       */
/* -------------------------------------------------------------------------- */

const zeroFor = (type: VarDef["type"]): unknown => {
    switch (type) {
        case "number":
            return 0;
        case "boolean":
            return false;
        case "color[]":
        case "string[]":
        case "number[]":
            return [];
        case "json":
            return null;
        default:
            return "";
    }
};

const matchesType = (type: VarDef["type"], value: unknown): boolean => {
    switch (type) {
        case "json":
            return true;
        case "number":
            return typeof value === "number" && Number.isFinite(value);
        case "boolean":
            return typeof value === "boolean";
        case "color":
        case "string":
            return typeof value === "string";
        case "color[]":
        case "string[]":
            return Array.isArray(value) && value.every((item) => typeof item === "string");
        case "number[]":
            return (
                Array.isArray(value) &&
                value.every((item) => typeof item === "number" && Number.isFinite(item))
            );
    }
};

const isBinding = (value: unknown): value is Binding => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    return "lit" in value || "var" in value || "step" in value || "template" in value;
};

const numericOps = new Set<Transform["op"]>([
    "lerp",
    "mapRange",
    "clamp",
    "round",
    "abs",
    "min",
    "max",
    "percent"
]);

/** Evaluate one var against already-resolved siblings. */
export const evaluateVar = (
    name: string,
    definition: VarDef,
    scope: RuntimeScope
): EvaluatedVar => {
    const warnings: string[] = [];
    let value: unknown;

    if (definition.fn) {
        const args: Record<string, unknown> = {};
        for (const [key, raw] of Object.entries(definition.args ?? {})) {
            args[key] = isBinding(raw) ? resolveBinding(raw, scope) : raw;
        }
        value = callBuiltin(definition.fn, args, scope);
    } else if (definition.from) {
        value = resolveBinding(definition.from, scope);
        for (const transform of definition.transform ?? []) {
            if (
                numericOps.has(transform.op) &&
                value !== undefined &&
                (typeof value !== "number" || !Number.isFinite(value))
            ) {
                warnings.push(`\`${transform.op}\` needs a number`);
            }
            value = applyTransform(value, transform, scope);
        }
    }

    if (value === undefined) {
        return {
            value:
                definition.fallback !== undefined ? definition.fallback : zeroFor(definition.type),
            warnings
        };
    }

    if (!matchesType(definition.type, value)) {
        if (
            definition.fallback !== undefined &&
            matchesType(definition.type, definition.fallback)
        ) {
            warnings.push(`expected ${definition.type}, used the fallback`);
            return { value: definition.fallback, warnings };
        }
        warnings.push(`expected ${definition.type}, used ${String(zeroFor(definition.type))}`);
        return { value: zeroFor(definition.type), warnings };
    }

    void name;
    return { value, warnings };
};

/** Topological evaluation; vars may reference vars declared later. */
export const evaluateVars = (
    definitions: Record<string, VarDef>,
    scope: RuntimeScope
): EvaluatedVars => {
    const values: Record<string, unknown> = {};
    const warnings: string[] = [];
    const visiting = new Set<string>();
    const done = new Set<string>();

    const visit = (name: string): void => {
        if (done.has(name)) return;
        if (visiting.has(name)) {
            warnings.push(`vars.${name}: cycle, used the fallback`);
            return;
        }

        const definition = definitions[name];
        if (!definition) return;

        visiting.add(name);
        for (const dependency of varDependencies(definition)) {
            if (dependency in definitions) visit(dependency);
        }
        visiting.delete(name);

        if (done.has(name)) return;

        const result = evaluateVar(name, definition, { ...scope, vars: values });
        values[name] = result.value;
        warnings.push(...result.warnings.map((warning) => `vars.${name}: ${warning}`));
        done.add(name);
    };

    for (const name of Object.keys(definitions)) visit(name);

    return { values, warnings };
};
