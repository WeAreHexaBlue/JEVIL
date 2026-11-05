import { describe, expect, it } from "vitest";
import {
    appCreateSchema,
    appDisplayFromBlueprint,
    appPatchSchema,
    appSlugBase,
    appSlugCandidate,
    parseTags,
    MAX_BLUEPRINT_BYTES
} from "./app";

const meta = (overrides: Record<string, unknown> = {}) => ({
    meta: {
        title: "Palette Oracle",
        tagline: "A word goes in. A palette comes out.",
        description: "Turn a word into color.",
        icon: "🎨",
        accent: "violet",
        tags: ["color", "generative"],
        ...overrides
    }
});

describe("appCreateSchema", () => {
    it("accepts a known template", () => {
        expect(appCreateSchema.parse({ template: "blank" })).toEqual({ template: "blank" });
    });

    it("rejects an unknown template and extra fields", () => {
        expect(appCreateSchema.safeParse({ template: "nope" }).success).toBe(false);
        expect(appCreateSchema.safeParse({ template: "blank", title: "x" }).success).toBe(false);
        expect(appCreateSchema.safeParse({}).success).toBe(false);
    });
});

describe("appPatchSchema", () => {
    it("requires a positive revision and a blueprint", () => {
        expect(appPatchSchema.safeParse({ revision: 1, blueprint: {} }).success).toBe(true);
        expect(appPatchSchema.safeParse({ revision: 0, blueprint: {} }).success).toBe(false);
        expect(appPatchSchema.safeParse({ revision: 1 }).success).toBe(false);
        expect(appPatchSchema.safeParse({ revision: 1, blueprint: {}, extra: true }).success).toBe(
            false
        );
    });

    it("advertises the draft size ceiling", () => {
        expect(MAX_BLUEPRINT_BYTES).toBe(256 * 1024);
    });
});

describe("appDisplayFromBlueprint", () => {
    it("reads the display columns out of meta", () => {
        expect(appDisplayFromBlueprint(meta())).toEqual({
            title: "Palette Oracle",
            tagline: "A word goes in. A palette comes out.",
            description: "Turn a word into color.",
            icon: "🎨",
            accent: "violet",
            tags: ["color", "generative"]
        });
    });

    it("survives a half-written draft", () => {
        expect(appDisplayFromBlueprint(null)).toMatchObject({
            title: "Untitled app",
            tagline: "",
            description: null,
            icon: "✳️",
            accent: "violet",
            tags: []
        });
        expect(appDisplayFromBlueprint({ meta: { title: "   " } })).toMatchObject({
            title: "Untitled app"
        });
        expect(appDisplayFromBlueprint({ meta: "not an object" })).toMatchObject({
            title: "Untitled app"
        });
    });

    it("clips long text and drops bad tags and accents", () => {
        const display = appDisplayFromBlueprint(
            meta({
                title: "x".repeat(80),
                accent: "chartreuse",
                tags: ["ok-tag", "Not A Tag", "another", "three", "four", "five", "six"]
            })
        );

        expect(display.title).toHaveLength(48);
        expect(display.accent).toBe("violet");
        expect(display.tags).toEqual(["ok-tag", "another", "three", "four", "five"]);
    });
});

describe("app slugs", () => {
    it("turns a title into a kebab-case base", () => {
        expect(appSlugBase("Palette Oracle")).toBe("palette-oracle");
        expect(appSlugBase("  Café  au   Lait! ")).toBe("cafe-au-lait");
        expect(appSlugBase("✳️")).toBe("untitled-app");
    });

    it("suffixes without exceeding the slug limit", () => {
        const base = appSlugBase("a".repeat(40));
        const candidate = appSlugCandidate(base, 12);

        expect(candidate.endsWith("-12")).toBe(true);
        expect(candidate.length).toBeLessThanOrEqual(48);
        expect(appSlugCandidate(base, 0)).toBe(base);
    });
});

describe("parseTags", () => {
    it("returns only strings from a stored array", () => {
        expect(parseTags(JSON.stringify(["a", 1, null, "b"]))).toEqual(["a", "b"]);
        expect(parseTags("not json")).toEqual([]);
        expect(parseTags(JSON.stringify({ tag: "a" }))).toEqual([]);
    });
});
