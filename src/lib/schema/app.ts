/**
 * Request and view shapes for maker apps (SPEC §9.2, §12).
 *
 * Drafts are deliberately loose: a blueprint being edited can be half-finished,
 * so the PATCH boundary checks size and shape but not `jevil/app@1` semantics.
 * The editor runs `validateBlueprint` on every keystroke and blocks publish;
 * the public catalog never sees a draft.
 */

import { z } from "zod";

/** Keep in sync with `editorTemplateIds` in `#lib/templates`. */
export const appTemplateSchema = z.enum(["blank", "palette-oracle", "vibe-check", "cover-maker"]);

export type AppTemplateId = z.infer<typeof appTemplateSchema>;

export const appCreateSchema = z.strictObject({
    template: appTemplateSchema
});

export const appPatchSchema = z.strictObject({
    /** The revision the editor started from. A mismatch is a 409, not a loss. */
    revision: z.number().int().min(1),
    blueprint: z.unknown()
});

export const appVisibilitySchema = z.enum(["draft", "unlisted", "public", "blocked"]);

export type AppVisibility = z.infer<typeof appVisibilitySchema>;

export const appAccentSchema = z.enum(["blue", "pink", "lime", "tangerine", "violet", "sky"]);

export type AppAccent = z.infer<typeof appAccentSchema>;

/** WHAT A MAKER SEES. `blueprint` is decoded so clients never parse JSON twice. */
export interface AppView {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    description: string | null;
    icon: string;
    accent: AppAccent;
    tags: string[];
    blueprint: unknown;
    draftRevision: number;
    visibility: AppVisibility;
    publishedVersionId: string | null;
    remixedFromAppId: string | null;
    remixedFromVersionId: string | null;
    createdAt: number;
    updatedAt: number;
    publishedAt: number | null;
}

export const MAX_BLUEPRINT_BYTES = 256 * 1024;

const MAX_TITLE = 48;
const MAX_TAGLINE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_ICON = 40;
const MAX_TAGS = 5;
const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, max: number): string =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

export interface AppDisplay {
    title: string;
    tagline: string;
    description: string | null;
    icon: string;
    accent: AppAccent;
    tags: string[];
}

const FALLBACK: AppDisplay = {
    title: "Untitled app",
    tagline: "",
    description: null,
    icon: "✳️",
    accent: "violet",
    tags: []
};

/**
 * Read the display columns out of a draft's `meta` without requiring the draft
 * to be valid. Missing pieces fall back; present pieces are clipped.
 */
export const appDisplayFromBlueprint = (blueprint: unknown): AppDisplay => {
    if (!record(blueprint) || !record(blueprint.meta)) return { ...FALLBACK };

    const meta = blueprint.meta;
    const title = text(meta.title, MAX_TITLE);
    const tagline = text(meta.tagline, MAX_TAGLINE);
    const description = text(meta.description, MAX_DESCRIPTION);
    const icon = text(meta.icon, MAX_ICON);
    const accent = appAccentSchema.safeParse(meta.accent);
    const tags = Array.isArray(meta.tags)
        ? meta.tags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.trim().toLowerCase())
              .filter((tag) => TAG_PATTERN.test(tag))
              .slice(0, MAX_TAGS)
        : [];

    return {
        title: title.length > 0 ? title : FALLBACK.title,
        tagline,
        description: description.length > 0 ? description : null,
        icon: icon.length > 0 ? icon : FALLBACK.icon,
        accent: accent.success ? accent.data : FALLBACK.accent,
        tags
    };
};

/** Lowercase kebab-case base for a title, always long enough to be a slug. */
export const appSlugBase = (title: string): string => {
    const slug = title
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
        .replace(/-+$/g, "");

    return slug.length >= 3 ? slug : "untitled-app";
};

/** Add a numeric suffix while staying inside the 48-char slug limit. */
export const appSlugCandidate = (base: string, attempt: number): string => {
    if (attempt <= 0) return base;

    const suffix = `-${attempt}`;
    const stem = base.slice(0, 48 - suffix.length).replace(/-+$/g, "");
    return `${stem || "app"}${suffix}`;
};

/** Parse the JSON columns on an app row, tolerating an older bad value. */
export const parseStoredJson = (value: string): unknown => {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

export const parseTags = (value: string): string[] => {
    const parsed = parseStoredJson(value);
    return Array.isArray(parsed)
        ? parsed.filter((tag): tag is string => typeof tag === "string").slice(0, MAX_TAGS)
        : [];
};
