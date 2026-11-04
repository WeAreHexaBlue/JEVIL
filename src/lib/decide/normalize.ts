/**
 * Answer normalization (SPEC §10.3), shared by server adapters and the
 * browser's direct local-endpoint transport.
 *
 * This module must stay client-safe: no Workers, Node, or server imports.
 * One bad answer never fails a run; it is dropped and reported to `onDrop`.
 */

import type { Answer, Question } from "./types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (value: unknown): number | undefined =>
    typeof value === "number" && Number.isFinite(value) ? value : undefined;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const clampIndex = (value: number, count: number): number =>
    Math.min(count - 1, Math.max(0, Math.round(value)));

/** Normalize a vector to sum to 1; all-zero stays all-zero. */
const normalizeVector = (vector: number[]): number[] => {
    const sum = vector.reduce((total, value) => total + value, 0);
    return sum > 0 ? vector.map((value) => value / sum) : vector;
};

const choiceAnswer = (
    candidate: Record<string, unknown>,
    criteria: Record<string, string>
): Answer | null => {
    const keys = Object.keys(criteria);
    const choice = candidate.choice;
    if (typeof choice !== "string" || !keys.includes(choice)) return null;

    const raw = isRecord(candidate.probabilities) ? candidate.probabilities : {};
    const vector = keys.map((key) => {
        const value = finite(raw[key]);
        return value !== undefined && value >= 0 ? value : 0;
    });
    const normalized = normalizeVector(vector);

    const probabilities: Record<string, number> = {};
    keys.forEach((key, index) => {
        probabilities[key] = normalized[index];
    });

    const probability = probabilities[choice];
    const confidence = clamp01(finite(candidate.confidence) ?? probability);

    return { type: "choice", choice, confidence, probabilities };
};

const scoreAnswer = (candidate: Record<string, unknown>, criteria: string[]): Answer | null => {
    const count = criteria.length;
    const raw = isRecord(candidate.probabilities) ? candidate.probabilities : {};

    const vector = criteria.map((label, index) => {
        const value = finite(raw[label]) ?? finite(raw[String(index)]);
        return value !== undefined && value >= 0 ? value : 0;
    });
    const sum = vector.reduce((total, value) => total + value, 0);

    let normalized: number[];
    let level: number;

    if (sum > 0) {
        normalized = normalizeVector(vector);
        level = normalized.reduce(
            (best, value, index) => (value > normalized[best] ? index : best),
            0
        );
    } else {
        const rawLevel =
            finite(candidate.level) ?? finite(candidate.score) ?? finite(candidate.raw_score);
        if (rawLevel === undefined) return null;
        level = clampIndex(rawLevel, count);
        normalized = criteria.map(() => 0);
    }

    const tail = count - 1;
    const score =
        sum > 0
            ? normalized.reduce((total, value, index) => total + (index * value) / tail, 0)
            : level / tail;

    const probabilities: Record<string, number> = {};
    normalized.forEach((value, index) => {
        probabilities[String(index)] = value;
    });

    const confidence = clamp01(finite(candidate.confidence) ?? (sum > 0 ? normalized[level] : 0));

    return {
        type: "score",
        score: clamp01(score),
        confidence,
        probabilities,
        level,
        levels: count
    };
};

const noulAnswer = (candidate: Record<string, unknown>): Answer | null => {
    const raw = finite(candidate.noul) ?? finite(candidate.probability);
    if (raw === undefined) return null;
    return { type: "noul", noul: clamp01(raw) };
};

export interface NormalizeResult {
    answers: Record<string, Answer>;
    /** Question ids whose answer was missing or unusable. */
    dropped: string[];
}

export interface NormalizeOptions {
    /** Called for every dropped question id. Defaults to doing nothing. */
    onDrop?: (questionId: string) => void;
}

/**
 * Turn a provider's answer map into the shared contract.
 *
 * - `choice`: the choice must be a criteria key; probabilities are normalized to
 *   sum to 1, and missing options become 0.
 * - `score`: probabilities may be keyed by level label or index, and are
 *   normalized into `score = Σ i·pᵢ / (n−1)`; without a distribution, the raw
 *   `level`/`score` is clamped into range and confidence is 0 (unknown).
 * - `noul`: accepts `noul` or `probability` and clamps to 0..1.
 */
export const normalizeAnswers = (
    rawAnswers: unknown,
    questions: Record<string, Question>,
    { onDrop }: NormalizeOptions = {}
): NormalizeResult => {
    const source = isRecord(rawAnswers) ? rawAnswers : {};
    const answers: Record<string, Answer> = {};
    const dropped: string[] = [];

    for (const [questionId, question] of Object.entries(questions)) {
        const candidate = source[questionId];
        let answer: Answer | null = null;

        if (isRecord(candidate)) {
            if (question.type === "choice") {
                answer = choiceAnswer(candidate, question.criteria);
            } else if (question.type === "score") {
                answer = scoreAnswer(candidate, question.criteria);
            } else {
                answer = noulAnswer(candidate);
            }
        }

        if (answer) {
            answers[questionId] = answer;
        } else {
            dropped.push(questionId);
            onDrop?.(questionId);
        }
    }

    return { answers, dropped };
};
