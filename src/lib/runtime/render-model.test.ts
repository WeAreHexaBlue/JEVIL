/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures are mutated to break one thing at a time */
import { describe, expect, it } from "vitest";
import type { Blueprint } from "#lib/schema/blueprint";
import { formatIssues, validateBlueprint } from "#lib/schema/blueprint";
import type { RuntimeSnapshot } from "./runner";
import { resolveTree, textValue, visibleOf } from "./render-model";

const base = (): any => ({
    schema: "jevil/app@1",
    meta: {
        title: "Render Test",
        tagline: "A small tree for the resolver.",
        tags: ["test"],
        accent: "violet",
        icon: "✨",
        engine: { media: ["text"] }
    },
    inputs: [
        { id: "word", type: "text", label: "Word", default: "petrichor" },
        {
            id: "mood",
            type: "select",
            label: "Mood",
            options: [
                { value: "calm", label: "Calm" },
                { value: "loud", label: "Loud" }
            ],
            default: "calm"
        }
    ],
    steps: [
        {
            id: "read",
            kind: "decide",
            state: { lit: "anything" },
            questions: {
                family: {
                    type: "choice",
                    instructions: "Which family?",
                    criteria: { calm: "Still", loud: "Sharp" }
                }
            }
        }
    ],
    vars: {
        title: { type: "string", from: { lit: "Hello" } },
        hue: { type: "number", from: { lit: 210 } }
    },
    ui: {
        type: "Stack",
        id: "root",
        props: { gap: 6 },
        children: [
            {
                type: "Heading",
                id: "heading",
                props: { text: { template: "{{vars.title}}, {{inputs.word}}" } }
            },
            { type: "Text", id: "body", props: { text: { step: "read", question: "family" } } },
            { type: "TextInput", id: "input", props: { input: "word" } },
            {
                type: "Button",
                id: "again",
                props: {
                    label: "Run it",
                    action: { ref: "again" }
                }
            },
            {
                type: "Button",
                id: "link",
                props: {
                    label: "Open",
                    action: { kind: "open", url: { lit: "https://example.com/a" } }
                }
            },
            { type: "Spacer", id: "gap", props: { size: 4 } }
        ]
    },
    actions: {
        again: { kind: "run" },
        pick: { kind: "set", var: "mood", value: { lit: "loud" } },
        copy: { kind: "copy", value: { var: "hue" }, label: "Copied" }
    }
});

const blueprint = (mutate?: (value: any) => void): Blueprint => {
    const value = base();
    mutate?.(value);
    const result = validateBlueprint(value);
    if (!result.ok) throw new Error(formatIssues(result.issues));
    return result.blueprint;
};

const snapshot = (answers: RuntimeSnapshot["answers"] = {}): RuntimeSnapshot => ({
    status: "success",
    stale: false,
    steps: [],
    answers,
    vars: { title: "Hello", hue: 210 },
    warnings: [],
    seed: "seed"
});

const family = {
    type: "choice" as const,
    choice: "calm",
    confidence: 0.8,
    probabilities: { calm: 0.8, loud: 0.2 }
};

const child = (result: ReturnType<typeof resolveTree>, id: string) => {
    const found = result.root?.children.find((node) => node.id === id);
    if (!found) throw new Error(`missing node ${id}`);
    return found;
};

describe("visibleOf", () => {
    it("follows the documented coercion", () => {
        expect(visibleOf(undefined)).toBe(true);
        expect(visibleOf(null)).toBe(true);
        expect(visibleOf(true)).toBe(true);
        expect(visibleOf(false)).toBe(false);
        expect(visibleOf(0.5)).toBe(false);
        expect(visibleOf(0.51)).toBe(true);
        expect(visibleOf("")).toBe(false);
        expect(visibleOf("yes")).toBe(true);
    });
});

describe("resolveTree", () => {
    it("resolves templates, answers, vars, and prop defaults", () => {
        const result = resolveTree(blueprint(), snapshot({ read: { family } }), {
            word: "comet"
        });

        expect(result.warnings).toEqual([]);
        expect(result.root?.type).toBe("Stack");
        expect(result.root?.props.gap).toBe(6);
        expect(result.root?.props.direction).toBe("column");
        expect(child(result, "heading").props.text).toBe("Hello, comet");
        expect(child(result, "body").props.text).toBe("calm");
        expect(child(result, "body").props.size).toBe("md");
        expect(child(result, "gap").props.size).toBe(4);
    });

    it("collects inputs placed in the body", () => {
        const result = resolveTree(blueprint(), snapshot());

        expect(result.usedInputs).toEqual(["word"]);
    });

    it("drops a hidden subtree", () => {
        const app = blueprint((value) => {
            value.ui.children[0].visible = { lit: false };
            value.ui.children[1].visible = { lit: 0.2 };
            value.ui.children[2].visible = { lit: "" };
        });
        const result = resolveTree(app, snapshot());

        expect(result.root?.children.map((node) => node.id)).toEqual(["again", "link", "gap"]);
    });

    it("keeps nodes whose visible binding is missing", () => {
        const app = blueprint((value) => {
            value.ui.children[0].visible = { step: "read", question: "family" };
        });

        expect(resolveTree(app, snapshot()).root?.children[0]?.id).toBe("heading");
    });

    it("returns a null root when the root is hidden", () => {
        const app = blueprint((value) => {
            value.ui.visible = { lit: false };
        });

        expect(resolveTree(app, snapshot()).root).toBeNull();
    });

    it("warns and drops unknown components and props", () => {
        const app = blueprint();
        const tree = {
            ...app,
            ui: {
                type: "Stack",
                id: "root",
                children: [
                    { type: "Html", id: "bad", props: { text: "x" } },
                    { type: "Text", id: "ok", props: { text: "hi", bogus: true } }
                ]
            }
        } as unknown as Blueprint;

        const result = resolveTree(tree, snapshot());

        expect(result.root?.children.map((node) => node.id)).toEqual(["ok"]);
        expect(
            result.warnings.some((warning) => warning.includes("Unknown component `Html`"))
        ).toBe(true);
        expect(result.warnings.some((warning) => warning.includes("no `bogus` prop"))).toBe(true);
    });

    it("ignores children on a non-container", () => {
        const app = blueprint();
        const tree = {
            ...app,
            ui: {
                type: "Stack",
                id: "root",
                children: [
                    {
                        type: "Text",
                        id: "text",
                        props: { text: "hi" },
                        children: [{ type: "Text", id: "nested", props: { text: "no" } }]
                    }
                ]
            }
        } as unknown as Blueprint;

        const result = resolveTree(tree, snapshot());

        expect(result.root?.children[0]?.children).toEqual([]);
        expect(result.warnings.some((warning) => warning.includes("cannot have children"))).toBe(
            true
        );
    });
});

describe("actions", () => {
    it("resolves an action ref", () => {
        const result = resolveTree(blueprint(), snapshot());

        expect(child(result, "again").action).toEqual({ kind: "run" });
    });

    it("resolves a set action value against the scope", () => {
        const app = blueprint((value) => {
            value.actions.set_it = { kind: "set", var: "mood", value: { var: "vars.hue" } };
            value.ui.children.push({
                type: "Button",
                id: "set",
                props: { label: "Set", action: { ref: "set_it" } }
            });
        });

        expect(child(resolveTree(app, snapshot()), "set").action).toEqual({
            kind: "set",
            input: "mood",
            value: 210
        });
    });

    it("resolves copy text and its label", () => {
        const app = blueprint((value) => {
            value.ui.children.push({
                type: "Button",
                id: "copy",
                props: { label: "Copy", action: { ref: "copy" } }
            });
        });

        expect(child(resolveTree(app, snapshot()), "copy").action).toEqual({
            kind: "copy",
            text: "210",
            label: "Copied"
        });
    });

    it("accepts an https URL and rejects anything else", () => {
        const good = resolveTree(blueprint(), snapshot());
        expect(child(good, "link").action).toEqual({
            kind: "open",
            url: "https://example.com/a"
        });

        const app = blueprint((value) => {
            value.ui.children[4].props.action = {
                kind: "open",
                url: { template: "{{inputs.word}}" }
            };
        });
        const bad = resolveTree(app, snapshot(), { word: "http://example.com" });
        expect(child(bad, "link").action).toBeUndefined();
        expect(bad.warnings.some((warning) => warning.includes("unusable action"))).toBe(true);
    });

    it("warns when an action ref is unknown", () => {
        const app = blueprint();
        const tree = {
            ...app,
            ui: {
                type: "Stack",
                id: "root",
                children: [
                    {
                        type: "Button",
                        id: "again",
                        props: { label: "Run", action: { ref: "missing" } }
                    }
                ]
            }
        } as unknown as Blueprint;
        const result = resolveTree(tree, snapshot());

        expect(child(result, "again").action).toBeUndefined();
        expect(result.warnings.some((warning) => warning.includes("unusable action"))).toBe(true);
    });
});

describe("textValue", () => {
    it("renders primitives, JSON, and blanks", () => {
        expect(textValue("hi")).toBe("hi");
        expect(textValue(0.5)).toBe("0.5");
        expect(textValue(true)).toBe("true");
        expect(textValue({ a: 1 })).toBe('{"a":1}');
        expect(textValue(null)).toBe("");
        expect(textValue(undefined)).toBe("");
    });
});
