/**
 * The seed apps JEVIL ships with (ROADMAP phase 2).
 *
 * Blueprints are hand-authored JSON, not database rows yet. They are validated
 * on first use with the same `jevil/app@1` validator a published app goes
 * through, so a mistake in a seed fails loudly here instead of rendering a
 * half-empty page. The raw JSON is kept for the read-only source viewer.
 */

import coverMaker from "./cover-maker.json";
import paletteOracle from "./palette-oracle.json";
import vibeCheck from "./vibe-check.json";
import { formatIssues, validateBlueprint, type Blueprint } from "#lib/schema/blueprint";

export interface SeedApp {
    /** URL segment under `/apps`. Also the stable identity before D1 exists. */
    slug: string;
    blueprint: Blueprint;
    /** Exactly what is shown at `/apps/[slug]/source`. */
    source: unknown;
}

interface SeedDefinition {
    slug: string;
    json: unknown;
}

const definitions: SeedDefinition[] = [
    { slug: "palette-oracle", json: paletteOracle },
    { slug: "vibe-check", json: vibeCheck },
    { slug: "cover-maker", json: coverMaker }
];

const cache = new Map<string, SeedApp>();

const build = (definition: SeedDefinition): SeedApp => {
    const result = validateBlueprint(definition.json);
    if (!result.ok) {
        throw new Error(
            `Seed app \`${definition.slug}\` does not match jevil/app@1:\n${formatIssues(result.issues)}`
        );
    }

    return {
        slug: definition.slug,
        blueprint: result.blueprint,
        source: structuredClone(definition.json)
    };
};

/** All seeds, validated. Order is the order they appear in lists. */
export const listSeedApps = (): SeedApp[] =>
    definitions.map((definition) => {
        const existing = cache.get(definition.slug);
        if (existing) return existing;

        const app = build(definition);
        cache.set(definition.slug, app);
        return app;
    });

/** One seed by slug, or `undefined` so the route can answer with a 404. */
export const getSeedApp = (slug: string): SeedApp | undefined =>
    listSeedApps().find((app) => app.slug === slug);

/** Slugs only; handy for `entries()` and tests. */
export const seedSlugs = (): string[] => definitions.map((definition) => definition.slug);
