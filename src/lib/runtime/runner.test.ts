/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures are mutated to break one thing at a time */
import { describe, expect, it } from "vitest";
import type { Answer, DecideResponse } from "#lib/decide/types";
import type { Blueprint } from "#lib/schema/blueprint";
import { validateBlueprint, formatIssues } from "#lib/schema/blueprint";
import { createRunner, initialInputs, type DecideTransport } from "./runner";

const base = (): any => ({
    schema: "jevil/app@1",
    meta: {
        title: "Tiny Oracle",
        tagline: "One word in, one field out.",
        tags: ["test"],
        accent: "violet",
        icon: "✨",
        engine: { media: ["text"] }
    },
    inputs: [
        { id: "word", type: "text", label: "Word", default: "petrichor", maxLength: 64 },
        { id: "energy", type: "slider", label: "Energy", min: 0, max: 1, step: 0.1, default: 0.5 },
        { id: "loud", type: "toggle", label: "Loud" }
    ],
    steps: [
        {
            id: "read",
            kind: "decide",
            label: "Read the word",
            state: { template: "The word is {{inputs.word}}" },
            questions: {
                family: {
                    type: "choice",
                    instructions: "Which family?",
                    criteria: { calm: "Still", loud: "Sharp" }
                },
                energy: {
                    type: "score",
                    instructions: "How energetic?",
                    criteria: ["still", "moving"]
                }
            }
        },
        {
            id: "echo",
            kind: "decide",
            label: "Echo it back",
            state: { template: "It read {{steps.read.family}}" },
            when: { var: "inputs.loud" },
            questions: { spark: { type: "noul", instructions: "Does it spark?" } }
        }
    ],
    vars: {
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
    },
    ui: {
        type: "Stack",
        id: "root",
        children: [{ type: "Text", id: "out", props: { text: { var: "label" } } }]
    },
    preview: {
        inputs: { word: "rain", energy: 0.25, loud: false },
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
                    score: 0.25,
                    confidence: 0.6,
                    probabilities: { "0": 0.5, "1": 0.5 }
                }
            }
        }
    }
});

const blueprint = (mutate?: (value: any) => void): Blueprint => {
    const value = base();
    mutate?.(value);
    const result = validateBlueprint(value);
    if (!result.ok) throw new Error(formatIssues(result.issues));
    return result.blueprint;
};

const family: Answer = {
    type: "choice",
    choice: "calm",
    confidence: 0.8,
    probabilities: { calm: 0.8, loud: 0.2 }
};
const energy: Answer = {
    type: "score",
    score: 0.5,
    level: 1,
    levels: 2,
    confidence: 0.6,
    probabilities: { "0": 0.4, "1": 0.6 }
};
const spark: Answer = { type: "noul", noul: 0.3 };

const respond = (answers: DecideResponse["answers"]): DecideResponse => ({
    model: "stub",
    answers
});

/** A transport that answers every step with the same shape. */
const happy = (): DecideTransport => async (request) => {
    const questions = Object.keys(request.questions);
    const answers: DecideResponse["answers"] = {};
    for (const id of questions) {
        answers[id] = id === "family" ? family : id === "energy" ? energy : spark;
    }
    return respond(answers);
};

const waitFor = async (predicate: () => boolean): Promise<void> => {
    for (let index = 0; index < 100; index += 1) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 1));
    }
    throw new Error("condition never became true");
};

describe("initialInputs", () => {
    it("applies defaults by type and ignores unknown ids", () => {
        const inputs = initialInputs(blueprint(), { word: "rain", nope: "x" });

        expect(inputs).toEqual({ word: "rain", energy: 0.5, loud: false });
    });

    it("coerces query strings, clamps sliders, and truncates text", () => {
        const inputs = initialInputs(blueprint(), {
            word: "x".repeat(80),
            energy: "4",
            loud: "true"
        });

        expect(inputs.word).toHaveLength(64);
        expect(inputs.energy).toBe(1);
        expect(inputs.loud).toBe(true);
    });

    it("falls back for values the input type cannot take", () => {
        const inputs = initialInputs(blueprint(), { energy: "loud", loud: "maybe" });

        expect(inputs.energy).toBe(0.5);
        expect(inputs.loud).toBe(false);
    });
});

describe("initial state", () => {
    it("starts idle with defaults, evaluated vars, and pending steps", () => {
        const runner = createRunner({ blueprint: blueprint(), preview: false });
        const snapshot = runner.getSnapshot();

        expect(snapshot.status).toBe("idle");
        expect(snapshot.stale).toBe(false);
        expect(snapshot.answers).toEqual({});
        expect(snapshot.vars).toEqual({ hue: 0, label: "" });
        expect(snapshot.steps.map((step) => step.status)).toEqual(["pending", "pending"]);
        expect(snapshot.seed).toBe(JSON.stringify({ energy: 0.5, loud: false, word: "petrichor" }));
    });

    it("renders the preview answers and marks its step done", () => {
        const runner = createRunner({ blueprint: blueprint() });
        const snapshot = runner.getSnapshot();

        expect(snapshot.status).toBe("preview");
        expect(snapshot.answers.read?.family).toEqual(family);
        expect(snapshot.vars.hue).toBe(90);
        expect(snapshot.vars.label).toBe("It reads calm");
        expect(snapshot.steps.map((step) => step.status)).toEqual(["done", "pending"]);
    });

    it("can ignore the preview on request", () => {
        const runner = createRunner({ blueprint: blueprint(), preview: false });

        expect(runner.getSnapshot().status).toBe("idle");
        expect(runner.getSnapshot().answers).toEqual({});
    });
});

describe("running", () => {
    it("executes steps in order with interpolated state", async () => {
        const states: unknown[] = [];
        const decide: DecideTransport = async (request) => {
            states.push(request.state);
            return happy()(request, { signal: new AbortController().signal });
        };

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        runner.setInput("loud", true);
        const snapshot = await runner.run();

        expect(states).toEqual(["The word is petrichor", "It read calm"]);
        expect(snapshot.status).toBe("success");
        expect(snapshot.stale).toBe(false);
        expect(snapshot.answers.read).toEqual({ family, energy });
        expect(snapshot.answers.echo).toEqual({ spark });
        expect(snapshot.vars).toEqual({ hue: 180, label: "It reads calm" });
        expect(snapshot.steps.map((step) => step.status)).toEqual(["done", "done"]);
    });

    it("skips a step whose `when` is false", async () => {
        const decide = happy();
        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        const snapshot = await runner.run();

        expect(snapshot.steps.map((step) => step.status)).toEqual(["done", "skipped"]);
        expect(snapshot.answers.echo).toBeUndefined();
        expect(snapshot.status).toBe("success");
    });

    it("sends the step model and does not leak inputs into other steps", async () => {
        const requests: unknown[] = [];
        const decide: DecideTransport = async (request) => {
            requests.push(request);
            return respond({ family, energy });
        };

        const runner = createRunner({
            blueprint: blueprint((value) => {
                value.steps[0]!.model = "jev-1";
            }),
            decide,
            preview: false
        });
        await runner.run();

        expect(requests[0]).toMatchObject({ model: "jev-1", state: "The word is petrichor" });
        expect(requests[0]).not.toHaveProperty("_raw");
    });

    it("is idempotent while running", async () => {
        let calls = 0;
        const decide: DecideTransport = async () => {
            calls += 1;
            await new Promise((resolve) => setTimeout(resolve, 5));
            return respond({ family, energy });
        };

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        const first = runner.run();
        const second = runner.run();

        expect(second).toBe(first);
        await first;
        expect(calls).toBe(1);
    });

    it("reports a missing connection instead of throwing", async () => {
        const runner = createRunner({ blueprint: blueprint(), preview: false });
        const snapshot = await runner.run();

        expect(snapshot.status).toBe("error");
        expect(snapshot.error?.code).toBe("no_connection");
        expect(snapshot.steps.every((step) => step.status === "pending")).toBe(true);
    });
});

describe("failures", () => {
    it("stops at the failing step and keeps earlier answers", async () => {
        let calls = 0;
        const decide: DecideTransport = async () => {
            calls += 1;
            if (calls === 2)
                throw Object.assign(new Error("provider said no"), { code: "rate_limit" });
            return respond({ family, energy });
        };

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        runner.setInputs({ loud: true });
        const snapshot = await runner.run();

        expect(snapshot.status).toBe("error");
        expect(snapshot.error).toEqual({
            code: "rate_limit",
            message: "Too many requests. Wait a moment, then run it again."
        });
        expect(snapshot.answers.read).toEqual({ family, energy });
        expect(snapshot.answers.echo).toBeUndefined();
        expect(snapshot.steps.map((step) => step.status)).toEqual(["done", "error"]);
        expect(snapshot.steps[1]?.error?.code).toBe("rate_limit");
    });

    it("never shows a provider message", async () => {
        const decide: DecideTransport = async () => {
            throw new Error("sk-live-secret in the payload");
        };

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        const snapshot = await runner.run();

        expect(snapshot.error?.code).toBe("unexpected");
        expect(snapshot.error?.message).not.toContain("sk-live-secret");
    });

    it("treats a response that misses a question as malformed", async () => {
        const decide: DecideTransport = async () => respond({ family });

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        const snapshot = await runner.run();

        expect(snapshot.status).toBe("error");
        expect(snapshot.error?.code).toBe("missing_answers");
        expect(snapshot.steps[0]?.status).toBe("error");
    });

    it("rejects a response that fails the answer schema", async () => {
        const decide: DecideTransport = async () =>
            ({
                model: "stub",
                answers: { family: { type: "choice" } }
            }) as unknown as DecideResponse;

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        const snapshot = await runner.run();

        expect(snapshot.error?.code).toBe("malformed");
    });

    it("times out a slow step and keeps the run recoverable", async () => {
        const decide: DecideTransport = (_request, { signal }) =>
            new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () =>
                    reject(new DOMException("aborted", "AbortError"))
                );
            });

        const runner = createRunner({
            blueprint: blueprint(),
            decide,
            preview: false,
            timeoutMs: 5
        });
        const snapshot = await runner.run();

        expect(snapshot.status).toBe("error");
        expect(snapshot.error?.code).toBe("timeout");
    });

    it("rejects an interpolated state over 8,000 characters", async () => {
        const long = blueprint((value) => {
            value.inputs = [
                { id: "one", type: "text", label: "One", default: "x".repeat(4000) },
                { id: "two", type: "text", label: "Two", default: "y".repeat(4000) },
                { id: "three", type: "text", label: "Three", default: "z".repeat(4000) }
            ];
            value.steps = [
                {
                    id: "read",
                    kind: "decide",
                    state: { template: "{{inputs.one}}{{inputs.two}}{{inputs.three}}" },
                    questions: { family: value.steps[0]!.questions.family }
                }
            ];
            value.vars = {};
            value.ui = { type: "Text", id: "out", props: { text: "done" } };
            delete (value as { preview?: unknown }).preview;
        });

        const runner = createRunner({ blueprint: long, decide: happy(), preview: false });
        const snapshot = await runner.run();

        expect(snapshot.error?.code).toBe("state_too_large");
    });
});

describe("cancellation", () => {
    it("aborts the in-flight step and keeps completed answers", async () => {
        let calls = 0;
        const decide: DecideTransport = (_request, { signal }) => {
            calls += 1;
            if (calls === 1) return Promise.resolve(respond({ family, energy }));
            return new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () =>
                    reject(new DOMException("aborted", "AbortError"))
                );
            });
        };

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        runner.setInput("loud", true);
        const running = runner.run();
        await waitFor(() => calls === 2);
        runner.cancel();
        const snapshot = await running;

        expect(snapshot.status).toBe("cancelled");
        expect(snapshot.error?.code).toBe("cancelled");
        expect(snapshot.answers.read).toEqual({ family, energy });
        expect(snapshot.steps[1]?.status).toBe("error");
        expect(runner.busy).toBe(false);
    });

    it("ignores cancel when nothing is running", () => {
        const runner = createRunner({ blueprint: blueprint(), preview: false });
        expect(() => runner.cancel()).not.toThrow();
        expect(runner.getSnapshot().status).toBe("idle");
    });
});

describe("inputs and staleness", () => {
    it("marks a finished result stale and recomputes vars", async () => {
        const runner = createRunner({ blueprint: blueprint(), decide: happy(), preview: false });
        const first = await runner.run();
        const seed = first.seed;

        runner.setInputs({ word: "comet" });
        const snapshot = runner.getSnapshot();

        expect(snapshot.stale).toBe(true);
        expect(snapshot.status).toBe("success");
        expect(snapshot.seed).not.toBe(seed);
        expect(snapshot.warnings).toEqual([]);
    });

    it("does not mark a fresh run stale and clears it on re-run", async () => {
        const runner = createRunner({ blueprint: blueprint(), decide: happy(), preview: false });
        await runner.run();
        runner.setInput("word", "comet");
        expect(runner.getSnapshot().stale).toBe(true);

        const snapshot = await runner.run();
        expect(snapshot.stale).toBe(false);
        expect(snapshot.status).toBe("success");
    });

    it("ignores unchanged and unknown values", async () => {
        const runner = createRunner({ blueprint: blueprint(), preview: false });
        const before = runner.getSnapshot();

        runner.setInputs({ word: "petrichor", nope: "x" });

        expect(runner.getSnapshot()).toBe(before);
    });

    it("resets to defaults and drops answers", async () => {
        const runner = createRunner({ blueprint: blueprint(), decide: happy(), preview: false });
        runner.setInput("word", "comet");
        await runner.run();

        runner.reset();
        const snapshot = runner.getSnapshot();

        expect(snapshot.status).toBe("idle");
        expect(snapshot.answers).toEqual({});
        expect(snapshot.vars).toEqual({ hue: 0, label: "" });
        expect(runner.inputValues.word).toBe("petrichor");
        expect(snapshot.steps.every((step) => step.status === "pending")).toBe(true);
    });

    it("cannot publish over a reset from a run that was in flight", async () => {
        const decide: DecideTransport = async (_request, { signal }) => {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 20);
                signal.addEventListener("abort", () => {
                    clearTimeout(timer);
                    reject(new DOMException("aborted", "AbortError"));
                });
            });
            return respond({ family, energy });
        };

        const runner = createRunner({ blueprint: blueprint(), decide, preview: false });
        const running = runner.run();
        runner.reset();
        await running;

        expect(runner.getSnapshot().status).toBe("idle");
    });
});

describe("seed and determinism", () => {
    it("derives the seed from sorted inputs and accepts an override", () => {
        const runner = createRunner({
            blueprint: blueprint(),
            preview: false,
            inputs: { word: "rain", energy: 0.25, loud: true }
        });

        expect(runner.getSnapshot().seed).toBe(
            JSON.stringify({ energy: 0.25, loud: true, word: "rain" })
        );

        const seeded = createRunner({
            blueprint: blueprint(),
            preview: false,
            seed: "fixed"
        });
        expect(seeded.getSnapshot().seed).toBe("fixed");
    });

    it("produces the same palette for the same inputs", async () => {
        const app = blueprint((value) => {
            value.vars = {
                colors: {
                    type: "color[]",
                    fn: "palette",
                    args: {
                        hue: 205,
                        saturation: 50,
                        lightness: 50,
                        harmony: "triadic",
                        count: 3
                    }
                }
            };
            value.ui = { type: "Palette", id: "out", props: { colors: { var: "colors" } } };
            delete (value as { preview?: unknown }).preview;
        });

        const first = await createRunner({
            blueprint: app,
            decide: happy(),
            seed: "petrichor"
        }).run();
        const second = await createRunner({
            blueprint: app,
            decide: happy(),
            seed: "petrichor"
        }).run();

        expect(first.vars.colors).toEqual(second.vars.colors);
        expect(first.vars.colors).toHaveLength(3);
        for (const color of first.vars.colors as string[]) {
            expect(color).toMatch(/^#[0-9a-f]{6}$/);
        }
    });
});

describe("subscriptions", () => {
    it("notifies listeners and stops after unsubscribe", async () => {
        const runner = createRunner({ blueprint: blueprint(), decide: happy(), preview: false });
        const seen: string[] = [];
        const stop = runner.subscribe((snapshot) => seen.push(snapshot.status));

        await runner.run();
        stop();
        runner.setInput("word", "comet");

        expect(seen[0]).toBe("running");
        expect(seen.at(-1)).toBe("success");
        expect(runner.getSnapshot().stale).toBe(true);
    });
});
