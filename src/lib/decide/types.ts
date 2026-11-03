/**
 * The shared decision contract (SPEC §1.4).
 *
 * Requests are what JEVIL sends to a provider; responses are what a provider
 * returns *after* `normalizeAnswers()` has made them uniform. Schemas live here
 * so every adapter, route, and test agrees on the boundary.
 */

import { z } from "zod";

/** Score questions carry 2–10 ordered levels (SPEC §1.4). */
export const SCORE_LEVEL_MIN = 2;
export const SCORE_LEVEL_MAX = 10;

const unit = z.number().min(0).max(1);

/** Anything a caller may send as model state: text, an object, or a list. */
export const decideStateSchema = z.union([
    z.string(),
    z.record(z.string(), z.unknown()),
    z.array(z.unknown())
]);

/** `choice`: pick one key from `criteria`. */
export const choiceQuestionSchema = z
    .object({
        type: z.literal("choice"),
        instructions: z.string().min(1),
        criteria: z
            .record(z.string(), z.string())
            .refine(
                (criteria) => Object.keys(criteria).length > 0,
                "A choice question needs at least one option."
            )
    })
    .strict();

/** `score`: an ordered ladder of levels, low to high. */
export const scoreQuestionSchema = z
    .object({
        type: z.literal("score"),
        instructions: z.string().min(1),
        criteria: z.array(z.string().min(1)).min(SCORE_LEVEL_MIN).max(SCORE_LEVEL_MAX)
    })
    .strict();

/** `noul`: a single 0..1 degree with no options. */
export const noulQuestionSchema = z
    .object({
        type: z.literal("noul"),
        instructions: z.string().min(1)
    })
    .strict();

export const questionSchema = z.discriminatedUnion("type", [
    choiceQuestionSchema,
    scoreQuestionSchema,
    noulQuestionSchema
]);

export const questionsSchema = z.record(z.string().min(1), questionSchema);

/** A probability map keyed by option key or level label. */
export const probabilitiesSchema = z.record(z.string(), unit);

const answerBase = {
    confidence: unit,
    probabilities: probabilitiesSchema
};

/**
 * Normalized answers. `confidence` and every probability are already 0..1;
 * adapters must not hand raw provider numbers to these schemas.
 */
export const choiceAnswerSchema = z
    .object({
        type: z.literal("choice"),
        choice: z.string().min(1),
        ...answerBase
    })
    .strict();

export const scoreAnswerSchema = z
    .object({
        type: z.literal("score"),
        /** Normalized 0..1 position, low to high. */
        score: unit,
        ...answerBase,
        /** Raw index into the question's levels, for UI copy. */
        level: z.number().int().nonnegative().optional(),
        /** Number of levels the raw index came from. */
        levels: z.number().int().min(SCORE_LEVEL_MIN).optional()
    })
    .strict()
    .refine(
        (answer) =>
            answer.level === undefined ||
            answer.levels === undefined ||
            answer.level < answer.levels,
        "level must be inside levels"
    );

export const noulAnswerSchema = z
    .object({
        type: z.literal("noul"),
        noul: unit
    })
    .strict();

export const answerSchema = z.discriminatedUnion("type", [
    choiceAnswerSchema,
    scoreAnswerSchema,
    noulAnswerSchema
]);

export const answersSchema = z.record(z.string().min(1), answerSchema);

export const usageSchema = z
    .object({
        input_tokens: z.number().int().nonnegative().optional(),
        billed_tokens: z.number().int().nonnegative().optional(),
        output_tokens: z.number().int().nonnegative().optional()
    })
    .strict();

/**
 * Outbound request. Strict: an unknown field is a caller bug, not something to
 * silently forward to a provider.
 */
export const decideRequestSchema = z
    .object({
        state: decideStateSchema,
        questions: questionsSchema,
        model: z.string().min(1).optional()
    })
    .strict();

/**
 * Inbound response from a provider, already normalized by the adapter.
 *
 * Unknown top-level fields are stripped. `_raw` is for local debugging only:
 * never persist it, return it to a client, or log it.
 */
export const decideResponseSchema = z.object({
    model: z.string().min(1),
    answers: answersSchema,
    usage: usageSchema.optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    _raw: z.unknown().optional()
});

export type DecideState = z.infer<typeof decideStateSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type ScoreQuestion = z.infer<typeof scoreQuestionSchema>;
export type NoulQuestion = z.infer<typeof noulQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;
export type ScoreAnswer = z.infer<typeof scoreAnswerSchema>;
export type NoulAnswer = z.infer<typeof noulAnswerSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type DecideRequest = z.infer<typeof decideRequestSchema>;
export type DecideResponse = z.infer<typeof decideResponseSchema>;
export type Usage = z.infer<typeof usageSchema>;
