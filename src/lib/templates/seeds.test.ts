import { describe, expect, it } from "vitest";
import { canvasScene } from "#lib/runtime/canvas";
import { resolveTree } from "#lib/runtime/render-model";
import { createRunner } from "#lib/runtime/runner";
import { listSeedApps } from "./index";

const HEX = /^#[0-9a-f]{6}$/;

for (const app of listSeedApps()) {
    describe(`seed: ${app.blueprint.meta.title}`, () => {
        it("opens on a clean preview", () => {
            const runner = createRunner({ blueprint: app.blueprint });
            const snapshot = runner.getSnapshot();

            expect(snapshot.status).toBe("preview");
            expect(snapshot.warnings).toEqual([]);
            expect(snapshot.steps.every((step) => step.status === "done")).toBe(true);

            const tree = resolveTree(app.blueprint, snapshot, runner.inputValues);
            expect(tree.root).not.toBeNull();
            expect(tree.warnings).toEqual([]);
            const declared = new Set(app.blueprint.inputs.map((input) => input.id));
            for (const id of tree.usedInputs) expect(declared.has(id)).toBe(true);
        });

        it("evaluates its declared vars against the sample answers", () => {
            const runner = createRunner({ blueprint: app.blueprint });
            const vars = runner.getSnapshot().vars;

            expect(Object.keys(vars).length).toBeGreaterThan(0);
            for (const [key, value] of Object.entries(vars)) {
                expect(value, key).not.toBeNull();
            }

            const colors = vars.colors;
            if (colors !== undefined) {
                expect(Array.isArray(colors)).toBe(true);
                for (const color of colors as string[]) expect(color).toMatch(HEX);
            }
        });

        it("resets to the sample, not to empty result state", () => {
            const runner = createRunner({ blueprint: app.blueprint });
            runner.setInputs({});
            runner.reset();
            const snapshot = runner.getSnapshot();

            expect(snapshot.status).toBe("preview");
            expect(Object.keys(snapshot.answers).length).toBeGreaterThan(0);
        });

        it("fails with a safe message when no connection is installed", async () => {
            const runner = createRunner({ blueprint: app.blueprint, preview: false });
            const snapshot = await runner.run();

            expect(snapshot.status).toBe("error");
            expect(snapshot.error?.code).toBe("no_connection");
            expect(snapshot.error?.message).not.toContain("provider");
        });

        it("paints the same canvas for the same inputs", () => {
            const runner = createRunner({ blueprint: app.blueprint });
            const scene = canvasScene({
                paint: "stripes",
                height: 180,
                colors: ["#112233", "#445566"],
                seed: runner.getSnapshot().seed
            });

            expect(
                canvasScene({
                    paint: "stripes",
                    height: 180,
                    colors: ["#112233", "#445566"],
                    seed: runner.getSnapshot().seed
                })
            ).toEqual(scene);
        });
    });
}
