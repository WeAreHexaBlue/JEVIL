import { describe, expect, it } from "vitest";
import type { Answer } from "#lib/decide/types";
import type { AppMeta, Binding, Transform, VarDef } from "#lib/schema/blueprint";
import {
    evaluateVar,
    evaluateVars,
    hashString,
    inputSeed,
    resolveBinding,
    resolveTemplate,
    type RuntimeScope
} from "./bindings";

const meta: AppMeta = {
    title: "Tiny Oracle",
    tagline: "One word in, one field out.",
    description: "A test app.",
    tags: ["test"],
    accent: "violet",
    icon: "✨",
    engine: { media: ["text"] }
};

const answers: Record<string, Record<string, Answer>> = {
    read: {
        family: {
            type: "choice",
            choice: "calm",
            confidence: 0.71,
            probabilities: { calm: 0.71, loud: 0.29 }
        },
        energy: {
            type: "score",
            score: 0.5,
            level: 1,
            levels: 3,
            confidence: 0.6,
            probabilities: { "0": 0.2, "1": 0.6, "2": 0.2 }
        },
        spark: { type: "noul", noul: 0.4 }
    }
};

const scope: RuntimeScope = {
    inputs: { word: "petrichor", count: 3, on: true },
    answers,
    meta
};

const binding = (value: unknown): Binding => ({ lit: value }) as unknown as Binding;

const definition = (value: unknown, chain: Transform[], type: VarDef["type"] = "number"): VarDef =>
    ({ type, from: binding(value), transform: chain }) as unknown as VarDef;

const run = (value: unknown, chain: Transform[], type: VarDef["type"] = "number") =>
    evaluateVar("test", definition(value, chain, type), scope);

describe("resolveBinding", () => {
    it("returns literals unchanged", () => {
        expect(resolveBinding(binding("hello"), scope)).toBe("hello");
        expect(resolveBinding(binding(3), scope)).toBe(3);
        expect(resolveBinding(binding([1, 2]), scope)).toEqual([1, 2]);
    });

    it("reads inputs, vars, and meta", () => {
        expect(resolveBinding({ var: "inputs.word" }, scope)).toBe("petrichor");
        expect(resolveBinding({ var: "vars.hue" }, { ...scope, vars: { hue: 210 } })).toBe(210);
        expect(resolveBinding({ var: "hue" }, { ...scope, vars: { hue: 210 } })).toBe(210);
        expect(resolveBinding({ var: "meta.title" }, scope)).toBe("Tiny Oracle");
        expect(resolveBinding({ var: "meta.engine" }, scope)).toBeUndefined();
    });

    it("reads answer values and picked fields", () => {
        expect(resolveBinding({ step: "read", question: "family" }, scope)).toBe("calm");
        expect(resolveBinding({ step: "read", question: "energy" }, scope)).toBe(0.5);
        expect(resolveBinding({ step: "read", question: "spark" }, scope)).toBe(0.4);
        expect(
            resolveBinding({ step: "read", question: "family", pick: "confidence" }, scope)
        ).toBe(0.71);
        expect(
            resolveBinding({ step: "read", question: "energy", pick: "probabilities" }, scope)
        ).toEqual({ "0": 0.2, "1": 0.6, "2": 0.2 });
        expect(resolveBinding({ step: "read", question: "spark", pick: "answer" }, scope)).toEqual({
            type: "noul",
            noul: 0.4
        });
        expect(resolveBinding({ step: "read", question: "missing" }, scope)).toBeUndefined();
        expect(resolveBinding({ step: "missing", question: "family" }, scope)).toBeUndefined();
        expect(
            resolveBinding({ step: "read", question: "spark", pick: "confidence" }, scope)
        ).toBeUndefined();
    });
});

describe("resolveTemplate", () => {
    it("interpolates inputs, meta, vars, and answers", () => {
        const text = resolveTemplate(
            "{{inputs.word}} / {{meta.title}} / {{vars.hue}} / {{steps.read.family}} / {{steps.read.family.choice}} / {{steps.read.energy.score}}",
            { ...scope, vars: { hue: 210 } }
        );

        expect(text).toBe("petrichor / Tiny Oracle / 210 / calm / calm / 0.5");
    });

    it("trims paths and renders missing values as empty", () => {
        expect(resolveTemplate("[{{  inputs.word  }}]", scope)).toBe("[petrichor]");
        expect(resolveTemplate("[{{inputs.nope}}]", scope)).toBe("[]");
        expect(resolveTemplate("[{{meta.description}}]", scope)).toBe("[A test app.]");
    });

    it("renders objects as JSON and numbers as text", () => {
        expect(resolveTemplate("{{steps.read.family.answer}}", scope)).toContain('"choice":"calm"');
        expect(resolveTemplate("{{steps.read.energy.score}}", scope)).toBe("0.5");
    });

    it("keeps an escaped opening literal", () => {
        expect(resolveTemplate("\\{{inputs.word}}", scope)).toBe("{{inputs.word}}");
        expect(resolveTemplate("a \\{{ b }} c", scope)).toBe("a {{ b }} c");
    });
});

describe("transforms", () => {
    it("maps numbers with lerp and mapRange, clamped by default", () => {
        expect(run(0.5, [{ op: "lerp", in: [0, 1], out: [10, 20] }]).value).toBe(15);
        expect(run(1.5, [{ op: "lerp", in: [0, 1], out: [10, 20] }]).value).toBe(20);
        expect(run(1.5, [{ op: "mapRange", in: [0, 1], out: [10, 20], clamp: false }]).value).toBe(
            25
        );
        expect(run(0, [{ op: "lerp", in: [1, 1], out: [10, 20] }]).value).toBe(10);
    });

    it("clamps, rounds, and takes absolutes", () => {
        expect(run(5, [{ op: "clamp", min: 0, max: 3 }]).value).toBe(3);
        expect(run(-0.5, [{ op: "abs" }]).value).toBe(0.5);
        expect(run(1.2345, [{ op: "round", to: 2 }]).value).toBe(1.23);
        expect(run(1.5, [{ op: "round" }]).value).toBe(2);
        expect(run(2, [{ op: "min", value: 5 }]).value).toBe(2);
        expect(run(2, [{ op: "max", value: 5 }]).value).toBe(5);
    });

    it("looks up keys with a default", () => {
        const map = { calm: "analogous", loud: "triadic" };
        expect(run("calm", [{ op: "lookup", map }], "string").value).toBe("analogous");
        expect(run("missing", [{ op: "lookup", map, default: "split" }], "string").value).toBe(
            "split"
        );
        expect(run(1, [{ op: "lookup", map: { "1": "one" } }], "string").value).toBe("one");
    });

    it("fills empty values with `default`", () => {
        expect(run("", [{ op: "default", value: "fallback" }], "string").value).toBe("fallback");
        expect(run("kept", [{ op: "default", value: "fallback" }], "string").value).toBe("kept");
        expect(run(Number.NaN, [{ op: "default", value: 7 }]).value).toBe(7);
    });

    it("concatenates the source, extra values, and affixes", () => {
        expect(
            run("0.5", [{ op: "concat", prefix: "It reads ", suffix: "!" }], "string").value
        ).toBe("It reads 0.5!");

        expect(
            run(
                "calm",
                [
                    {
                        op: "concat",
                        separator: " · ",
                        values: [{ var: "inputs.word" }, binding("now")]
                    }
                ],
                "string"
            ).value
        ).toBe("calm · petrichor · now");
    });

    it("formats percentages", () => {
        expect(run(0.71, [{ op: "percent" }], "string").value).toBe("71%");
        expect(run(0.71, [{ op: "percent", decimals: 1 }], "string").value).toBe("71.0%");
    });

    it("drops a transform result that does not match the declared type", () => {
        const result = run("calm", [{ op: "lerp", in: [0, 1], out: [0, 10] }]);

        expect(result.value).toBe(0);
        expect(result.warnings[0]).toContain("needs a number");
    });
});

describe("vars", () => {
    const definitions: Record<string, VarDef> = {
        colors: {
            type: "color[]",
            fn: "palette",
            args: {
                hue: { var: "hue" },
                saturation: 50,
                lightness: 50,
                harmony: "triadic",
                count: 3
            }
        },
        hue: {
            type: "number",
            from: { step: "read", question: "energy" },
            transform: [{ op: "lerp", in: [0, 1], out: [0, 360] }]
        },
        label: {
            type: "string",
            from: { step: "read", question: "family" },
            transform: [{ op: "concat", prefix: "It reads " }]
        }
    };

    it("evaluates regardless of declaration order", () => {
        const result = evaluateVars(definitions, scope);

        expect(result.warnings).toEqual([]);
        expect(result.values.hue).toBe(180);
        expect(result.values.label).toBe("It reads calm");
        expect(result.values.colors).toHaveLength(3);
    });

    it("uses fallbacks and zeros for missing dependencies", () => {
        const result = evaluateVars(
            {
                missing: { type: "number", from: { var: "nope" } },
                fallback: { type: "number", from: { var: "nope" }, fallback: 5 },
                text: { type: "string", from: { var: "nope" } },
                list: { type: "string[]", from: { var: "nope" } },
                json: { type: "json", from: { var: "nope" } }
            },
            scope
        );

        expect(result.values).toEqual({ missing: 0, fallback: 5, text: "", list: [], json: null });
    });

    it("warns and uses the fallback on a type mismatch", () => {
        const result = evaluateVars(
            {
                wrong: { type: "number", from: { step: "read", question: "family" } },
                saved: {
                    type: "number",
                    from: { step: "read", question: "family" },
                    fallback: 2
                }
            },
            scope
        );

        expect(result.values).toEqual({ wrong: 0, saved: 2 });
        expect(result.warnings).toEqual([
            "vars.wrong: expected number, used 0",
            "vars.saved: expected number, used the fallback"
        ]);
    });

    it("survives a cycle with a warning instead of looping", () => {
        const result = evaluateVars(
            {
                a: { type: "number", from: { var: "b" }, fallback: 1 },
                b: { type: "number", from: { var: "a" }, fallback: 2 }
            },
            scope
        );

        expect(result.warnings.some((warning) => warning.includes("cycle"))).toBe(true);
        expect(typeof result.values.a).toBe("number");
        expect(typeof result.values.b).toBe("number");
    });

    it("tracks dependencies through concat values and builtin args", () => {
        const result = evaluateVars(
            {
                joined: {
                    type: "string",
                    from: { lit: "x" },
                    transform: [{ op: "concat", values: [{ var: "tail" }] }]
                },
                tail: { type: "string", from: { lit: "y" } },
                list: { type: "string[]", from: { lit: ["x", "y"] } },
                first: { type: "json", fn: "first", args: { list: { var: "list" } } }
            },
            scope
        );

        expect(result.values.joined).toBe("xy");
        expect(result.values.list).toEqual(["x", "y"]);
        expect(result.values.first).toBe("x");
    });
});

describe("builtins", () => {
    const builtin = (fn: string, args: Record<string, unknown>, type: VarDef["type"] = "json") =>
        evaluateVar("test", { type, fn, args } as unknown as VarDef, scope);

    it("converts HSL to hex", () => {
        expect(builtin("hsl", { h: 0, s: 100, l: 50 }).value).toBe("#ff0000");
        expect(builtin("hsl", { h: 120, s: 100, l: 50 }).value).toBe("#00ff00");
        expect(builtin("hsl", { h: 240, s: 100, l: 50 }).value).toBe("#0000ff");
        expect(builtin("hsl", { h: 360, s: 100, l: 50 }).value).toBe("#ff0000");
        expect(builtin("hsl", { h: 0, s: 0, l: 0 }).value).toBe("#000000");
    });

    it("mixes, shades, and picks readable text", () => {
        expect(builtin("mix", { a: "#000000", b: "#ffffff", t: 0.5 }).value).toBe("#808080");
        expect(builtin("mix", { a: "#000000", b: "#ffffff", t: 2 }).value).toBe("#ffffff");
        expect(builtin("shade", { color: "#000000", amount: 0.5 }).value).toBe("#808080");
        expect(builtin("shade", { color: "#ffffff", amount: -1 }).value).toBe("#000000");

        expect(builtin("contrastText", { color: "#ffffff" }).value).toBe("#16150f");
        expect(builtin("contrastText", { color: "#000000" }).value).toBe("#ffffff");
    });

    it("formats numbers with en-US grouping", () => {
        expect(builtin("formatNumber", { value: 1234567.891, decimals: 2 }).value).toBe(
            "1,234,567.89"
        );
        expect(builtin("formatNumber", { value: -1234.5, decimals: 1 }).value).toBe("-1,234.5");
        expect(builtin("formatNumber", { value: 1234 }).value).toBe("1,234");
        expect(builtin("formatNumber", { value: -0.4 }).value).toBe("0");
    });

    it("picks deterministically and takes the first item", () => {
        const list = ["a", "b", "c", "d"];
        const first = builtin("pick", { list, seed: "fixed" });
        const again = builtin("pick", { list, seed: "fixed" });

        expect(first.value).toBe(again.value);
        expect(list).toContain(first.value);
        expect(builtin("pick", { list: [] }).value).toBeNull();
        expect(builtin("first", { list }).value).toBe("a");
        expect(builtin("first", { list: [] }).value).toBeNull();
    });

    it("defaults the seed from the inputs", () => {
        const withInputs = { ...scope, inputs: { word: "petrichor" } };
        const pickDef = {
            type: "json",
            fn: "pick",
            args: { list: ["a", "b", "c", "d", "e"] }
        } as unknown as VarDef;
        const one = evaluateVar("test", pickDef, withInputs).value;
        const two = evaluateVar("test", pickDef, withInputs).value;

        expect(one).toBe(two);
    });

    it("generates a stable, seeded palette", () => {
        const palette = {
            type: "color[]",
            fn: "palette",
            args: { hue: 205, saturation: 50, lightness: 50, harmony: "triadic", count: 5 }
        } as unknown as VarDef;

        const result = evaluateVar("colors", palette, { ...scope, seed: "petrichor" });

        expect(result.value).toEqual(["#2f6a97", "#9d3f6f", "#7bb33c", "#5790cd", "#d37c99"]);
        expect(result.warnings).toEqual([]);
        expect(evaluateVar("colors", palette, { ...scope, seed: "petrichor" }).value).toEqual(
            result.value
        );
    });

    it("clamps palette size and keeps every color valid", () => {
        const make = (count: number) =>
            evaluateVar(
                "colors",
                {
                    type: "color[]",
                    fn: "palette",
                    args: { hue: 0, saturation: 50, lightness: 50, harmony: "analogous", count }
                } as unknown as VarDef,
                { ...scope, seed: "x" }
            ).value as string[];

        expect(make(1)).toHaveLength(2);
        expect(make(20)).toHaveLength(12);
        for (const color of make(5)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });
});

describe("determinism", () => {
    it("hashes strings stably", () => {
        expect(hashString("a")).toBe(3826002220);
        expect(hashString("petrichor")).toBe(hashString("petrichor"));
    });

    it("builds the default seed in a key-independent order", () => {
        expect(inputSeed({ a: "1", b: "2" })).toBe(inputSeed({ b: "2", a: "1" }));
        expect(inputSeed({ a: 1 })).not.toBe(inputSeed({ a: 2 }));
    });
});
