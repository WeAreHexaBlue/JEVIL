import { describe, expect, it } from "vitest";
import { getEditorTemplate, getSeedApp, listSeedApps, seedSlugs } from "./index";
import { validateBlueprint } from "#lib/schema/blueprint";

describe("seed apps", () => {
    it("validates every seed on load", () => {
        const apps = listSeedApps();

        expect(apps.length).toBeGreaterThan(0);
        for (const app of apps) {
            expect(app.blueprint.schema).toBe("jevil/app@1");
            expect(app.slug).toMatch(/^[a-z0-9-]+$/);
        }
    });

    it("finds Palette Oracle by slug", () => {
        const app = getSeedApp("palette-oracle");

        expect(app?.blueprint.meta.title).toBe("Palette Oracle");
        expect(app?.blueprint.meta.icon).toBe("🎨");
        expect(app?.blueprint.preview?.answers?.read).toBeDefined();
    });

    it("returns undefined for an unknown slug", () => {
        expect(getSeedApp("not-a-real-app")).toBeUndefined();
    });

    it("lists slugs in definition order", () => {
        expect(seedSlugs()).toEqual(listSeedApps().map((app) => app.slug));
    });

    it("offers a valid blank starting point", () => {
        const app = getEditorTemplate("blank");

        expect(app).toBeDefined();
        expect(app!.blueprint.meta.title).toBe("Untitled app");
        expect(app!.blueprint.inputs).toEqual([]);
        expect(app!.blueprint.steps).toEqual([]);
        expect(
            validateBlueprint(app!.blueprint).ok,
            "the blank template must pass jevil/app@1"
        ).toBe(true);
    });

    it("offers each public seed as an editor template", () => {
        for (const slug of seedSlugs()) {
            expect(getEditorTemplate(slug)?.blueprint.meta.title).toBe(
                getSeedApp(slug)!.blueprint.meta.title
            );
        }

        expect(getEditorTemplate("nope")).toBeUndefined();
    });

    it("builds each seed once", () => {
        const first = getSeedApp("palette-oracle")!;
        const second = getSeedApp("palette-oracle")!;

        expect(first).toBe(second);
        expect(first.source).toEqual(second.source);
    });
});
