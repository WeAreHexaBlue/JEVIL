import { describe, expect, it } from "vitest";
import { answerSchema, decideRequestSchema, decideResponseSchema, questionSchema } from "./types";

describe("questionSchema", () => {
    it("accepts the three question shapes", () => {
        expect(
            questionSchema.safeParse({
                type: "choice",
                instructions: "Pick a palette.",
                criteria: { dusk: "Muted purples", dawn: "Warm pastels" }
            }).success
        ).toBe(true);

        expect(
            questionSchema.safeParse({
                type: "score",
                instructions: "How loud?",
                criteria: ["Whisper", "Talk", "Shout"]
            }).success
        ).toBe(true);

        expect(questionSchema.safeParse({ type: "noul", instructions: "How sure?" }).success).toBe(
            true
        );
    });

    it("rejects empty choice criteria and out-of-range score levels", () => {
        expect(
            questionSchema.safeParse({
                type: "choice",
                instructions: "Pick.",
                criteria: {}
            }).success
        ).toBe(false);

        expect(
            questionSchema.safeParse({
                type: "score",
                instructions: "How loud?",
                criteria: ["Only one"]
            }).success
        ).toBe(false);

        expect(
            questionSchema.safeParse({
                type: "score",
                instructions: "How loud?",
                criteria: Array.from({ length: 11 }, (_, index) => `Level ${index}`)
            }).success
        ).toBe(false);
    });

    it("rejects unknown question types and extra fields", () => {
        expect(questionSchema.safeParse({ type: "chat", instructions: "Hi" }).success).toBe(false);
        expect(
            questionSchema.safeParse({
                type: "noul",
                instructions: "How sure?",
                options: ["a", "b"]
            }).success
        ).toBe(false);
    });
});

describe("answerSchema", () => {
    it("accepts normalized answers", () => {
        expect(
            answerSchema.safeParse({
                type: "choice",
                choice: "dusk",
                confidence: 0.72,
                probabilities: { dusk: 0.72, dawn: 0.28 }
            }).success
        ).toBe(true);

        expect(
            answerSchema.safeParse({
                type: "score",
                score: 0.66,
                confidence: 0.8,
                probabilities: { low: 0.1, mid: 0.24, high: 0.66 },
                level: 2,
                levels: 3
            }).success
        ).toBe(true);

        expect(answerSchema.safeParse({ type: "noul", noul: 0.4 }).success).toBe(true);
    });

    it("rejects values outside 0..1", () => {
        expect(
            answerSchema.safeParse({
                type: "choice",
                choice: "dusk",
                confidence: 1.4,
                probabilities: { dusk: 0.9 }
            }).success
        ).toBe(false);

        expect(
            answerSchema.safeParse({
                type: "score",
                score: -0.1,
                confidence: 0.5,
                probabilities: {}
            }).success
        ).toBe(false);

        expect(answerSchema.safeParse({ type: "noul", noul: 2 }).success).toBe(false);
    });

    it("rejects a raw level outside the level count", () => {
        expect(
            answerSchema.safeParse({
                type: "score",
                score: 0.66,
                confidence: 0.8,
                probabilities: {},
                level: 3,
                levels: 3
            }).success
        ).toBe(false);
    });

    it("rejects unknown answer types", () => {
        expect(answerSchema.safeParse({ type: "text", text: "chat" }).success).toBe(false);
    });
});

describe("decideRequestSchema", () => {
    it("accepts string, object, and array state", () => {
        for (const state of ["a moody forest", { mood: "moody" }, [1, 2, 3]]) {
            expect(
                decideRequestSchema.safeParse({
                    state,
                    questions: { palette: { type: "noul", instructions: "How sure?" } }
                }).success
            ).toBe(true);
        }
    });

    it("requires questions and allows an optional model", () => {
        expect(decideRequestSchema.safeParse({ state: "x" }).success).toBe(false);

        const parsed = decideRequestSchema.safeParse({
            state: "x",
            questions: {},
            model: "laya"
        });

        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data.model).toBe("laya");
    });

    it("rejects extra top-level fields", () => {
        expect(
            decideRequestSchema.safeParse({
                state: "x",
                questions: {},
                apiKey: "sk_live_nope"
            }).success
        ).toBe(false);
    });
});

describe("decideResponseSchema", () => {
    it("accepts a normalized response with usage", () => {
        const parsed = decideResponseSchema.safeParse({
            model: "laya",
            answers: {
                palette: {
                    type: "choice",
                    choice: "dusk",
                    confidence: 0.72,
                    probabilities: { dusk: 0.72, dawn: 0.28 }
                }
            },
            usage: { input_tokens: 120, billed_tokens: 120 },
            meta: { requestId: "req_1" }
        });

        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.answers.palette.type).toBe("choice");
            expect(parsed.data.usage?.billed_tokens).toBe(120);
        }
    });

    it("accepts an empty answer map when every answer was dropped", () => {
        expect(decideResponseSchema.safeParse({ model: "laya", answers: {} }).success).toBe(true);
    });

    it("strips unknown top-level fields", () => {
        const parsed = decideResponseSchema.safeParse({
            model: "laya",
            answers: {},
            upstream_debug: "should not survive"
        });

        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data).not.toHaveProperty("upstream_debug");
    });

    it("rejects a response without a model or answers", () => {
        expect(decideResponseSchema.safeParse({ answers: {} }).success).toBe(false);
        expect(decideResponseSchema.safeParse({ model: "laya" }).success).toBe(false);
    });
});
