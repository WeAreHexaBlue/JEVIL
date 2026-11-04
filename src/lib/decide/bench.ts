/**
 * Bench question building, shared by the server action and the guest bench.
 *
 * The bench is a developer tool: it sends one state to a connection with a
 * choice, a score, and a noul question, so the normalized answer shape can be
 * read at a glance. Everything here is client-safe.
 */

import { decideRequestSchema, questionsSchema, type DecideRequest } from "./types";

export interface BenchValues {
    state: string;
    choiceInstructions: string;
    choiceOptions: string;
    scoreInstructions: string;
    scoreLevels: string;
    noulInstructions: string;
}

export const defaultBenchValues: BenchValues = {
    state: "",
    choiceInstructions: "Pick the palette that fits.",
    choiceOptions: "dusk, dawn, neon",
    scoreInstructions: "How intense is the mood?",
    scoreLevels: "calm, steady, electric",
    noulInstructions: "Does it spark joy?"
};

export const CHOICE_OPTION_MAX = 8;
export const SCORE_LEVEL_MAX = 10;

/** Split a comma or newline list, trim, and drop blanks and duplicates. */
export const splitList = (value: string, max: number): string[] => {
    const seen = new Set<string>();
    return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => {
            if (!item || seen.has(item)) return false;
            seen.add(item);
            return true;
        })
        .slice(0, max);
};

/** Build the three questions, falling back to usable defaults. */
export const buildBenchQuestions = (values: BenchValues) => {
    const options = splitList(values.choiceOptions, CHOICE_OPTION_MAX);
    const levels = splitList(values.scoreLevels, SCORE_LEVEL_MAX);

    return questionsSchema.parse({
        mood: {
            type: "choice",
            instructions: values.choiceInstructions.trim() || "Pick the closest option.",
            criteria: Object.fromEntries(options.map((option) => [option, option]))
        },
        energy: {
            type: "score",
            instructions: values.scoreInstructions.trim() || "How intense is it?",
            criteria: levels.length >= 2 ? levels : ["quiet", "steady", "loud"]
        },
        spark: {
            type: "noul",
            instructions: values.noulInstructions.trim() || "How much does it spark?"
        }
    });
};

export const buildBenchRequest = (values: BenchValues): DecideRequest =>
    decideRequestSchema.parse({
        state: values.state,
        questions: buildBenchQuestions(values)
    });
