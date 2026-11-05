import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import { formatIssues, validateBlueprint, type Blueprint } from "#lib/schema/blueprint";
import { createRunner } from "./runner";
import RuntimeApp from "./components/RuntimeApp.svelte";

/**
 * Server-side smoke test for the renderer: no DOM, no effects, just the tree
 * the runtime would paint on first load. It catches component dispatch
 * mistakes that the pure resolver cannot see.
 */
const base = () => ({
    schema: "jevil/app@1",
    meta: {
        title: "Render Test",
        tagline: "A small tree for the renderer.",
        tags: ["test"],
        accent: "violet",
        icon: "✨",
        engine: { media: ["text"] }
    },
    inputs: [{ id: "word", type: "text", label: "Your word", default: "petrichor" }],
    steps: [
        {
            id: "read",
            kind: "decide",
            state: { template: "Read {{inputs.word}}" },
            questions: {
                family: {
                    type: "choice",
                    instructions: "Which family?",
                    criteria: { calm: "Still", loud: "Sharp" }
                },
                energy: { type: "score", instructions: "How energetic?", criteria: ["low", "high"] }
            }
        }
    ],
    vars: {
        hue: {
            type: "number",
            from: { step: "read", question: "energy" },
            transform: [{ op: "lerp", in: [0, 1], out: [0, 360] }]
        },
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
        title: {
            type: "string",
            from: { step: "read", question: "family" },
            transform: [{ op: "concat", prefix: "You chose " }]
        }
    },
    ui: {
        type: "Stack",
        id: "root",
        props: { gap: 5 },
        children: [
            { type: "Heading", id: "title", props: { text: { var: "title" } } },
            { type: "TextInput", id: "word_field", props: { input: "word" } },
            {
                type: "Text",
                id: "hint",
                props: { text: "Pick a word and run it.", tone: "muted" }
            },
            {
                type: "Card",
                id: "result",
                props: { tone: "tint" },
                children: [
                    {
                        type: "ProbabilityBars",
                        id: "bars",
                        props: {
                            label: "Family",
                            probabilities: {
                                step: "read",
                                question: "family",
                                pick: "probabilities"
                            }
                        }
                    },
                    {
                        type: "Palette",
                        id: "palette",
                        props: { colors: { var: "colors" }, labels: true }
                    }
                ]
            },
            {
                type: "Canvas",
                id: "canvas",
                props: {
                    height: 200,
                    paint: "orb",
                    colors: { var: "colors" },
                    seed: { template: "{{inputs.word}}" }
                }
            },
            {
                type: "Button",
                id: "again",
                props: { label: "Read it again", action: { kind: "run" } }
            },
            {
                type: "IconButton",
                id: "copy",
                props: {
                    icon: "copy",
                    label: "Copy",
                    action: { kind: "copy", value: { var: "title" } }
                }
            }
        ]
    },
    preview: {
        inputs: { word: "rain" },
        answers: {
            read: {
                family: {
                    type: "choice",
                    choice: "calm",
                    confidence: 0.8,
                    probabilities: { calm: 0.8, loud: 0.2 }
                },
                energy: {
                    type: "score",
                    score: 0.5,
                    confidence: 0.6,
                    probabilities: { "0": 0.5, "1": 0.5 }
                }
            }
        }
    }
});

const blueprint = (): Blueprint => {
    const result = validateBlueprint(base());
    if (!result.ok) throw new Error(formatIssues(result.issues));
    return result.blueprint;
};

describe("RuntimeApp", () => {
    it("renders a preview with resolved text, fields, art, and actions", () => {
        const app = blueprint();
        const runner = createRunner({ blueprint: app });
        const { body } = render(RuntimeApp, { props: { blueprint: app, runner } });

        expect(body).toContain("Sample result");
        expect(body).toContain("You chose calm");
        expect(body).toContain("Your word");
        expect(body).toContain("Read it again");
        expect(body).toContain("<svg");
        expect(body).toContain("Generated orb");
        expect(body).toContain("Copy");
    });

    it("does not render bindings as text or HTML", () => {
        const app = blueprint();
        const runner = createRunner({ blueprint: app });
        const { body } = render(RuntimeApp, { props: { blueprint: app, runner } });

        expect(body).not.toContain("{{");
        expect(body).not.toContain("&lt;script");
    });
});
