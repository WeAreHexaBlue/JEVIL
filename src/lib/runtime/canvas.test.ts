import { describe, expect, it } from "vitest";
import {
    CANVAS_MAX_HEIGHT,
    CANVAS_MIN_HEIGHT,
    DEFAULT_BACKGROUND,
    DEFAULT_PALETTE,
    canvasScene,
    paintLabel,
    type SceneElement
} from "./canvas";

const options = {
    paint: "palette-field" as const,
    height: 240,
    colors: ["#ff0000", "#00ff00", "#0000ff"],
    energy: 0.5,
    seed: "petrichor"
};

const numbers = (element: SceneElement): number[] => {
    switch (element.kind) {
        case "rect":
            return [element.x, element.y, element.width, element.height];
        case "circle":
            return [element.cx, element.cy, element.r];
        case "line":
            return [element.x1, element.y1, element.x2, element.y2, element.strokeWidth];
        case "path":
            return [];
    }
};

describe("canvasScene", () => {
    it("is deterministic for the same seed", () => {
        expect(canvasScene(options)).toEqual(canvasScene(options));
    });

    it("changes when the seed or energy changes", () => {
        expect(canvasScene(options)).not.toEqual(canvasScene({ ...options, seed: "other" }));
        expect(canvasScene(options)).not.toEqual(canvasScene({ ...options, energy: 0.9 }));
    });

    it("clamps height and energy", () => {
        const short = canvasScene({ ...options, height: 40 });
        const tall = canvasScene({ ...options, height: 2000 });
        const cool = canvasScene({ ...options, energy: -1 });
        const hot = canvasScene({ ...options, energy: 4 });

        expect(short.height).toBe(CANVAS_MIN_HEIGHT);
        expect(tall.height).toBe(CANVAS_MAX_HEIGHT);
        expect(cool.elements.length).toBeGreaterThan(0);
        expect(hot.elements.length).toBeGreaterThan(cool.elements.length);
    });

    it("keeps every coordinate finite and inside a tolerant box", () => {
        for (const paint of ["palette-field", "stripes", "grain", "orb"] as const) {
            const scene = canvasScene({ ...options, paint });

            expect(scene.width).toBe(320);
            expect(scene.elements.length).toBeGreaterThan(0);

            for (const element of scene.elements) {
                for (const value of numbers(element)) {
                    expect(Number.isFinite(value)).toBe(true);
                }
                if (element.kind === "circle") {
                    expect(element.r).toBeGreaterThan(0);
                    expect(element.cx).toBeGreaterThanOrEqual(-1);
                    expect(element.cx).toBeLessThanOrEqual(scene.width + 1);
                }
            }
        }
    });

    it("falls back to the default palette and background", () => {
        const scene = canvasScene({
            ...options,
            colors: ["not-a-color", "#fff"],
            background: "chartreuse"
        });

        expect(scene.background).toBe(DEFAULT_BACKGROUND);
        const fills = scene.elements
            .filter((element) => element.kind === "circle")
            .map((element) => (element.kind === "circle" ? element.fill : ""));
        for (const fill of fills) {
            expect(DEFAULT_PALETTE).toContain(fill);
        }
    });

    it("accepts a valid background", () => {
        expect(canvasScene({ ...options, background: "#ABCDEF" }).background).toBe("#abcdef");
    });

    it("draws more grain at higher energy", () => {
        const calm = canvasScene({ ...options, paint: "grain", energy: 0 });
        const loud = canvasScene({ ...options, paint: "grain", energy: 1 });

        expect(loud.elements.length).toBeGreaterThan(calm.elements.length);
        expect(calm.elements.length).toBe(120);
        expect(loud.elements.length).toBe(440);
    });

    it("draws seven orb rings and one highlight", () => {
        const scene = canvasScene({ ...options, paint: "orb" });

        expect(scene.elements).toHaveLength(8);
        expect(scene.elements.at(-1)?.kind).toBe("circle");
    });

    it("labels every preset for assistive tech", () => {
        expect(paintLabel("palette-field")).toContain("color field");
        expect(paintLabel("stripes")).toContain("stripe");
        expect(paintLabel("grain")).toContain("grain");
        expect(paintLabel("orb")).toContain("orb");
    });
});
