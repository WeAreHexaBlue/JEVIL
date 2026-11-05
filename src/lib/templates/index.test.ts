import { describe, expect, it } from "vitest";
import { getSeedApp, listSeedApps, seedSlugs } from "./index";

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

    it("builds each seed once", () => {
        const first = getSeedApp("palette-oracle")!;
        const second = getSeedApp("palette-oracle")!;

        expect(first).toBe(second);
        expect(first.source).toEqual(second.source);
    });
});
