/* eslint-disable @typescript-eslint/no-explicit-any -- malformed fixtures are intentionally loosely typed */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatIssues, validateBlueprint, type BlueprintIssue } from "./blueprint";

/**
 * Two references: the normative Palette Oracle from APP-FORMAT §12, and a
 * small app that exercises every binding kind without extra noise. Focused
 * tests clone the small one and break exactly one thing.
 */
const oracle = (): any =>
    JSON.parse(readFileSync(new URL("../templates/palette-oracle.json", import.meta.url), "utf8"));

const minimal = (): any => ({
    schema: "jevil/app@1",
    meta: {
        title: "Tiny Oracle",
        tagline: "One word in, one color field out.",
        tags: ["test", "color"],
        accent: "violet",
        icon: "✨",
        engine: { media: ["text"], recommended: ["laya"] }
    },
    inputs: [{ id: "word", type: "text", label: "Word", default: "petrichor" }],
    steps: [
        {
            id: "read",
            kind: "decide",
            state: { template: "The word is {{inputs.word}}" },
            questions: {
                family: {
                    type: "choice",
                    instructions: "Which family fits?",
                    criteria: { calm: "Still and soft", loud: "Sharp and bright" }
                },
                energy: {
                    type: "score",
                    instructions: "How energetic is it?",
                    criteria: ["still", "moving", "kinetic"]
                },
                spark: { type: "noul", instructions: "Does it spark?" }
            }
        }
    ],
    vars: {
        hue: {
            type: "number",
            from: { step: "read", question: "energy" },
            transform: [{ op: "lerp", in: [0, 1], out: [205, 18] }]
        },
        colors: {
            type: "color[]",
            fn: "palette",
            args: {
                hue: { var: "hue" },
                saturation: 50,
                lightness: 50,
                harmony: "triadic",
                count: 5
            }
        },
        label: {
            type: "string",
            from: { step: "read", question: "family" },
            transform: [{ op: "concat", prefix: "It reads " }]
        }
    },
    ui: {
        type: "Stack",
        id: "root",
        children: [
            {
                type: "Heading",
                id: "title",
                props: { level: 2, text: { template: "“{{inputs.word}}”" } }
            },
            { type: "Text", id: "sub", props: { text: { var: "label" } } },
            {
                type: "Canvas",
                id: "field",
                props: {
                    height: 240,
                    paint: "palette-field",
                    colors: { var: "colors" },
                    energy: { step: "read", question: "energy" },
                    seed: { template: "{{inputs.word}}" }
                }
            },
            {
                type: "Button",
                id: "again",
                props: { label: "Read it again", action: { kind: "run" } }
            }
        ]
    }
});

const issuesOf = (value: unknown): BlueprintIssue[] => {
    const result = validateBlueprint(value);
    return result.ok ? [] : result.issues;
};

const pointers = (value: unknown): string[] => issuesOf(value).map((entry) => entry.pointer);

const expectIssue = (value: unknown, fragment: string, pointer?: string): void => {
    const found = issuesOf(value);
    expect(
        found.some(
            (entry) =>
                entry.message.includes(fragment) &&
                (pointer === undefined || entry.pointer === pointer)
        ),
        `expected an issue containing “${fragment}”, got ${JSON.stringify(found)}`
    ).toBe(true);
};

describe("valid blueprints", () => {
    it("accepts the Palette Oracle from APP-FORMAT §12", () => {
        const result = validateBlueprint(oracle());

        expect(result.ok).toBe(true);
        if (result.ok) expect(result.blueprint.meta.title).toBe("Palette Oracle");
    });

    it("accepts the minimal app with direct var bindings and an answer template", () => {
        const app = minimal();
        app.ui.children.push({
            type: "Text",
            id: "answered",
            props: { text: { template: "{{steps.read.family}} at {{steps.read.energy}}." } }
        });

        const result = validateBlueprint(app);
        expect(result.ok, result.ok ? "" : formatIssues(result.issues)).toBe(true);
    });

    it("accepts `vars.x` in a binding as well as the bare var name", () => {
        const app = minimal();
        app.vars.label.from = { var: "vars.hue" };
        app.vars.label.type = "json";

        expect(issuesOf(app)).toEqual([]);
    });
});

describe("document shape", () => {
    it("requires the exact schema string and rejects unknown fields", () => {
        const wrong = minimal();
        wrong.schema = "jevil/app@2";
        expectIssue(wrong, "Invalid input");

        const extra = minimal();
        extra.extra = true;
        expectIssue(extra, "Unrecognized key");
    });

    it("requires meta, inputs, steps, vars, and ui", () => {
        for (const field of ["meta", "inputs", "steps", "vars", "ui"]) {
            const app = minimal();
            delete app[field];
            expect(issuesOf(app).length).toBeGreaterThan(0);
        }
    });
});

describe("meta", () => {
    it("enforces title, tagline, tag, and accent limits", () => {
        const shortTagline = minimal();
        shortTagline.meta.tagline = "Short";
        expectIssue(shortTagline, "Too small");

        const tags = minimal();
        tags.meta.tags = ["a", "b", "c", "d", "e", "f"];
        expectIssue(tags, "Too big");

        const badAccent = minimal();
        badAccent.meta.accent = "rainbow";
        expectIssue(badAccent, "Invalid option");

        const badIcon = minimal();
        badIcon.meta.icon = "not-an-icon";
        expectIssue(badIcon, "Icon must be an emoji");
    });

    it("rejects media v1 engines cannot run", () => {
        const app = minimal();
        app.meta.engine.media = ["text", "image"];
        expectIssue(app, "v1 engines support text only", "/meta/engine/media");
    });
});

describe("limits", () => {
    const input = (id: string) => ({ id, type: "text", label: "Word", default: "x" });

    it("caps inputs, steps, and questions", () => {
        const inputs = minimal();
        inputs.inputs = Array.from({ length: 9 }, (_, index) => input(`word_${index}`));
        expectIssue(inputs, "Too big");

        const steps = minimal();
        steps.steps = Array.from({ length: 11 }, (_, index) => ({
            ...structuredClone(minimal().steps[0]),
            id: `read_${index}`
        }));
        expectIssue(steps, "Too big");

        const questions = minimal();
        const many: Record<string, unknown> = {};
        for (let index = 0; index < 21; index += 1) {
            many[`q_${index}`] = {
                type: "noul",
                instructions: "Does it spark?"
            };
        }
        questions.steps[0].questions = many;
        expectIssue(questions, "1–20 questions");
    });

    it("caps total questions across steps", () => {
        const app = minimal();
        app.steps = Array.from({ length: 3 }, (_, stepIndex) => {
            const questions: Record<string, unknown> = {};
            for (let index = 0; index < 14; index += 1) {
                questions[`q_${index}`] = { type: "noul", instructions: "Spark?" };
            }
            return {
                id: `read_${stepIndex}`,
                kind: "decide",
                state: { lit: "nothing" },
                questions
            };
        });

        expectIssue(app, "limited to 40 questions", "/steps");
    });

    it("caps UI nodes and depth", () => {
        const wide = minimal();
        wide.ui.children = [0, 1].map((group) => ({
            type: "Stack",
            id: `group_${group}`,
            children: Array.from({ length: 100 }, (_, index) => ({
                type: "Text",
                id: `t_${group}_${index}`,
                props: { text: "x" }
            }))
        }));
        expectIssue(wide, "limited to 200 nodes");

        let node: any = { type: "Text", id: "leaf", props: { text: "x" } };
        for (let index = 0; index < 13; index += 1) {
            node = { type: "Stack", id: `s_${index}`, children: [node] };
        }
        const deep = minimal();
        deep.ui = node;
        expectIssue(deep, "limited to 12");
    });

    it("caps interpolated state at 8,000 characters", () => {
        const app = minimal();
        app.steps[0].state = { lit: ["x".repeat(4000), "x".repeat(4000), "x".repeat(4000)] };
        expectIssue(app, "8,000 characters");
    });
});

describe("ids", () => {
    it("rejects duplicate input, step, and node ids", () => {
        const inputs = minimal();
        inputs.inputs.push({ id: "word", type: "text", label: "Again" });
        expectIssue(inputs, "Duplicate input id", "/inputs/1/id");

        const steps = minimal();
        steps.steps.push({ ...structuredClone(steps.steps[0]) });
        expectIssue(steps, "Duplicate step id", "/steps/1/id");

        const nodes = minimal();
        nodes.ui.children.push({
            type: "Text",
            id: "title",
            props: { text: "again" }
        });
        expectIssue(nodes, "Duplicate node id");
    });

    it("rejects invalid ids", () => {
        const app = minimal();
        app.inputs[0].id = "Word";
        expectIssue(app, "lowercase");

        const varApp = minimal();
        varApp.vars.Hue = varApp.vars.hue;
        delete varApp.vars.hue;
        expectIssue(varApp, "Invalid key in record", "/vars/Hue");
    });
});

describe("bindings", () => {
    it("rejects unknown inputs, vars, steps, and questions", () => {
        const input = minimal();
        input.ui.children[0].props.text = { template: "{{inputs.word}}" };
        input.inputs = [];
        expectIssue(input, "Unknown input");

        const variable = minimal();
        variable.vars.label.from = { var: "missing" };
        expectIssue(variable, "Unknown var");

        const step = minimal();
        step.vars.label.from = { step: "missing", question: "family" };
        expectIssue(step, "Unknown step");

        const question = minimal();
        question.vars.label.from = { step: "read", question: "missing" };
        expectIssue(question, "Unknown question");
    });

    it("rejects answer fields the question type does not have", () => {
        const app = minimal();
        app.vars.label.from = { step: "read", question: "family", pick: "score" };
        expectIssue(app, "answers have no `score` field");
    });

    it("rejects a var binding that reads answers", () => {
        const app = minimal();
        app.vars.label.from = { var: "steps.read.family" };
        expectIssue(app, "cannot read answers");
    });

    it("rejects unknown and malformed template paths", () => {
        const unknown = minimal();
        unknown.ui.children[0].props.text = { template: "{{inputs.nope}}" };
        expectIssue(unknown, "Unknown input", "/ui/children/0/props/text");

        const empty = minimal();
        empty.ui.children[0].props.text = { template: "{{}}" };
        expectIssue(empty, "empty {{ }}");

        const unclosed = minimal();
        unclosed.ui.children[0].props.text = { template: "{{inputs.word" };
        expectIssue(unclosed, "Unclosed template");

        const meta = minimal();
        meta.ui.children[0].props.text = { template: "{{meta.engine}}" };
        expectIssue(meta, "not readable in a binding");
    });

    it("allows an escaped brace as literal text", () => {
        const app = minimal();
        app.ui.children[0].props.text = { template: "\\{{literal}}" };
        expect(issuesOf(app)).toEqual([]);
    });

    it("rejects a non-boolean `when`, a non-text state, and a bad `visible` shape", () => {
        const when = minimal();
        when.steps[0].when = { lit: "yes" };
        expectIssue(when, "`when` must resolve to a boolean");

        const state = minimal();
        state.steps[0].state = { lit: 42 };
        expectIssue(state, "State must resolve to a string, object, or array");

        const visible = minimal();
        visible.ui.children[0].visible = { lit: [] };
        expectIssue(visible, "`visible` must resolve to a boolean or a number");
    });
});

describe("vars and transforms", () => {
    it("requires exactly one of `from` and `fn`", () => {
        const both = minimal();
        both.vars.hue.fn = "hsl";
        both.vars.hue.args = { h: 1, s: 2, l: 3 };
        expectIssue(both, "exactly one of `from` or `fn`");

        const neither = minimal();
        delete neither.vars.hue.from;
        expectIssue(neither, "exactly one of `from` or `fn`");
    });

    it("requires a source for transforms and a builtin for args", () => {
        const transform = minimal();
        delete transform.vars.hue.from;
        transform.vars.hue.fn = "hsl";
        transform.vars.hue.args = { h: 1, s: 2, l: 3 };
        expectIssue(transform, "`transform` needs a `from` source");

        const args = minimal();
        args.vars.hue.args = { h: 1 };
        expectIssue(args, "`args` needs a builtin `fn`");
    });

    it("detects var cycles", () => {
        const app = minimal();
        app.vars.hue.from = { var: "colors" };
        app.vars.colors = { type: "string", from: { var: "hue" } };

        expectIssue(app, "Var cycle");
    });

    it("checks transform shape and ranges", () => {
        const emptyRange = minimal();
        emptyRange.vars.hue.transform = [{ op: "lerp", in: [1, 1], out: [0, 1] }];
        expectIssue(emptyRange, "Input range cannot be empty");

        const emptyMap = minimal();
        emptyMap.vars.hue.transform = [{ op: "lookup", map: {} }];
        expectIssue(emptyMap, "lookup map cannot be empty");

        const negativeRound = minimal();
        negativeRound.vars.hue.transform = [{ op: "round", to: -1 }];
        expectIssue(negativeRound, "Too small");
    });

    it("checks that source, transforms, and declared type agree", () => {
        const source = minimal();
        source.vars.label.from = { step: "read", question: "energy" };
        delete source.vars.label.transform;
        expectIssue(source, "produces number, not string");

        const numeric = minimal();
        numeric.vars.hue.from = { step: "read", question: "family" };
        expectIssue(numeric, "This transform needs a number");

        const builtin = minimal();
        builtin.vars.colors.type = "string";
        expectIssue(builtin, "`palette` returns array");

        const fallback = minimal();
        fallback.vars.hue.fallback = "warm";
        expectIssue(fallback, "Fallback must match number");
    });

    it("checks builtin arguments", () => {
        const missing = minimal();
        delete missing.vars.colors.args.saturation;
        expectIssue(missing, "`saturation` is required");

        const unknown = minimal();
        unknown.vars.colors.args.opacity = 0.5;
        expectIssue(unknown, "Unknown `palette` argument");

        const wrong = minimal();
        wrong.vars.colors.args.harmony = "rainbow";
        expectIssue(wrong, "Expected harmony");

        const binding = minimal();
        binding.vars.colors.args.hue = { var: "label" };
        expectIssue(binding, "Expected number");
    });
});

describe("actions", () => {
    it("checks action refs, writable inputs, and open URLs", () => {
        const ref = minimal();
        ref.ui.children[3].props.action = { ref: "missing" };
        expectIssue(ref, "Unknown action");

        const set = minimal();
        set.actions = { pick: { kind: "set", var: "missing", value: { lit: "x" } } };
        expectIssue(set, "Unknown input");

        const open = minimal();
        open.actions = { go: { kind: "open", url: { lit: "javascript:alert(1)" } } };
        expectIssue(open, "https://");

        const relative = minimal();
        relative.actions = { go: { kind: "open", url: { lit: "/apps" } } };
        expectIssue(relative, "https://");
    });

    it("rejects a binding where an action belongs", () => {
        const app = minimal();
        app.ui.children[3].props.action = { var: "label" };
        expectIssue(app, "action cannot be a binding");
    });

    it("accepts a reusable action ref", () => {
        const app = minimal();
        app.actions = { again: { kind: "run" } };
        app.ui.children[3].props.action = { ref: "again" };
        expect(issuesOf(app)).toEqual([]);
    });
});

describe("ui nodes", () => {
    it("rejects unknown components and props", () => {
        const component = minimal();
        component.ui.children.push({ type: "Html", id: "bad", props: { text: "x" } });
        expectIssue(component, "Unknown component");

        const prop = minimal();
        prop.ui.children[0].props.size = 9;
        expectIssue(prop, "Unknown prop `size`");
    });

    it("rejects children on non-containers", () => {
        const app = minimal();
        app.ui.children[0].children = [{ type: "Text", id: "nested", props: { text: "x" } }];
        expectIssue(app, "cannot have children");
    });

    it("checks prop types, ranges, enums, and colors", () => {
        const height = minimal();
        height.ui.children[2].props.height = 100;
        expectIssue(height, "Below 120");

        const paint = minimal();
        paint.ui.children[2].props.paint = "watercolor";
        expectIssue(paint, "Expected one of");

        const colors = minimal();
        colors.ui.children[2].props.colors = ["#000000"];
        expectIssue(colors, "Expected 2–12 colors");

        const color = minimal();
        color.ui.children[2].props.background = "not-a-color";
        expectIssue(color, "Expected a color");
    });

    it("checks input components against the declared input", () => {
        const unknown = minimal();
        unknown.ui.children.push({
            type: "TextInput",
            id: "input",
            props: { input: "missing" }
        });
        expectIssue(unknown, "Unknown input `missing`");

        const mismatch = minimal();
        mismatch.inputs = [{ id: "word", type: "slider", label: "Word", min: 0, max: 1 }];
        mismatch.ui.children.push({
            type: "TextInput",
            id: "input",
            props: { input: "word" }
        });
        expectIssue(mismatch, "needs a text input");

        const literal = minimal();
        literal.ui.children.push({
            type: "TextInput",
            id: "input",
            props: { input: { lit: "missing" } }
        });
        expectIssue(literal, "Unknown input `missing`");
    });
});

describe("inputs", () => {
    it("requires select options and slider bounds", () => {
        const select = minimal();
        select.inputs = [{ id: "word", type: "select", label: "Word" }];
        expectIssue(select, "A select needs options");

        const slider = minimal();
        slider.inputs = [{ id: "word", type: "slider", label: "Word" }];
        expectIssue(slider, "A slider needs min and max");

        const inverted = minimal();
        inverted.inputs = [{ id: "word", type: "slider", label: "Word", min: 1, max: 0 }];
        expectIssue(inverted, "min < max");
    });

    it("checks defaults against the input type", () => {
        const toggle = minimal();
        toggle.inputs = [{ id: "word", type: "toggle", label: "Word", default: "yes" }];
        expectIssue(toggle, "Default must be a boolean");

        const slider = minimal();
        slider.inputs = [
            { id: "word", type: "slider", label: "Word", min: 0, max: 10, default: 11 }
        ];
        expectIssue(slider, "at most max");

        const select = minimal();
        select.inputs = [
            {
                id: "word",
                type: "select",
                label: "Word",
                options: [{ value: "a", label: "A" }],
                default: "b"
            }
        ];
        expectIssue(select, "one of the select options");

        const color = minimal();
        color.inputs = [{ id: "word", type: "color", label: "Word", default: "#fff" }];
        expectIssue(color, "#rrggbb");

        const text = minimal();
        text.inputs = [{ id: "word", type: "text", label: "Word", maxLength: 501 }];
        expectIssue(text, "Limit is 500");
    });

    it("rejects fields a type does not use and duplicate select values", () => {
        const unused = minimal();
        unused.inputs = [{ id: "word", type: "text", label: "Word", min: 0 }];
        expectIssue(unused, "min is only for sliders");

        const duplicate = minimal();
        duplicate.inputs = [
            {
                id: "word",
                type: "select",
                label: "Word",
                options: [
                    { value: "a", label: "A" },
                    { value: "a", label: "Again" }
                ]
            }
        ];
        expectIssue(duplicate, "Duplicate option value `a`");
    });
});

describe("questions", () => {
    it("checks criteria sizes and instruction length", () => {
        const choice = minimal();
        choice.steps[0].questions.family.criteria = { only: "One option" };
        expectIssue(choice, "2–24 options");

        const score = minimal();
        score.steps[0].questions.energy.criteria = ["only"];
        expectIssue(score, "Too small");

        const instructions = minimal();
        instructions.steps[0].questions.spark.instructions = "x".repeat(241);
        expectIssue(instructions, "Too big");
    });
});

describe("preview", () => {
    const sample = (): any => ({
        inputs: { word: "petrichor" },
        answers: {
            read: {
                family: {
                    type: "choice",
                    choice: "calm",
                    confidence: 0.6,
                    probabilities: { calm: 0.6, loud: 0.4 }
                },
                energy: {
                    type: "score",
                    score: 0.5,
                    confidence: 0.5,
                    probabilities: { "0": 0.2, "1": 0.6, "2": 0.2 }
                },
                spark: { type: "noul", noul: 0.4 }
            }
        }
    });

    it("accepts complete sample answers", () => {
        const app = minimal();
        app.preview = sample();
        expect(issuesOf(app)).toEqual([]);
    });

    it("requires required inputs and known ids", () => {
        const missing = minimal();
        delete missing.inputs[0].default;
        missing.preview = sample();
        delete missing.preview.inputs.word;
        expectIssue(missing, "Required input `word` is missing");

        const unknown = minimal();
        unknown.preview = sample();
        unknown.preview.inputs.nope = "x";
        expectIssue(unknown, "Unknown input `nope`");

        const step = minimal();
        step.preview = sample();
        step.preview.answers.missing = {};
        expectIssue(step, "Unknown step `missing`");

        const question = minimal();
        question.preview = sample();
        question.preview.answers.read.missing = { type: "noul", noul: 0.5 };
        expectIssue(question, "Unknown question `missing`");
    });

    it("checks answer types and choice keys", () => {
        const type = minimal();
        type.preview = sample();
        type.preview.answers.read.family = {
            type: "score",
            score: 0.5,
            confidence: 0.5,
            probabilities: { calm: 1 }
        };
        expectIssue(type, "Expected a choice answer");

        const choice = minimal();
        choice.preview = sample();
        choice.preview.answers.read.family.choice = "nope";
        expectIssue(choice, "is not a criteria key");

        const input = minimal();
        input.preview = sample();
        input.preview.inputs.word = 4;
        expectIssue(input, "Expected a string");
    });
});

describe("banned content", () => {
    it("rejects script tags, javascript: URLs, and data:text/html", () => {
        const script = minimal();
        script.ui.children[0].props.text = { lit: "<script>alert(1)</script>" };
        expectIssue(script, "Script tags are not allowed");

        const url = minimal();
        url.meta.description = "Open javascript:alert(1) to win";
        expectIssue(url, "javascript: URLs are not allowed");

        const data = minimal();
        data.inputs[0].label = "data:text/html,<h1>hi</h1>";
        expectIssue(data, "data:text/html URLs are not allowed");
    });
});

describe("formatIssues", () => {
    it("prints a pointer and message per issue", () => {
        const app = minimal();
        app.ui.children[2].props.height = 10;

        const text = formatIssues(issuesOf(app));
        expect(text).toContain("/ui/children/2/props/height");
        expect(text).toContain("Below 120");
    });

    it("escapes JSON pointer segments", () => {
        const app = minimal();
        app.ui.children[0].props["a/b"] = 1;
        expect(pointers(app).some((pointer) => pointer.includes("a~1b"))).toBe(true);
    });
});
