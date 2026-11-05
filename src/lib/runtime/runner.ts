/**
 * The app runtime (APP-FORMAT §10.1–§10.5).
 *
 * Framework-free on purpose: this runs in a Svelte component, in a test, and
 * inside the future editor preview without knowing about any of them. The
 * caller supplies inputs and a decide transport; the runner owns step order,
 * timeouts, cancellation, answers, vars, and run status.
 *
 * Two rules shape the code:
 *
 * - Nothing the provider says reaches the UI raw. Errors become a stable code
 *   and a fixed message, and responses are schema-checked before they are
 *   stored.
 * - A run never loses good work. Completed answers stay visible when a later
 *   step fails or the user cancels.
 */

import {
    decideRequestSchema,
    decideResponseSchema,
    type Answer,
    type DecideRequest,
    type DecideResponse,
    type Question
} from "#lib/decide/types";
import type { AppInput, AppQuestion, Binding, Blueprint, DecideStep } from "#lib/schema/blueprint";
import {
    evaluateVars,
    inputSeed,
    resolveBinding,
    textOf,
    type InputValue,
    type RuntimeScope
} from "./bindings";

/** 15 s per step, and 8,000 characters of interpolated state (APP-FORMAT §10.4). */
export const STEP_TIMEOUT_MS = 15_000;
export const STATE_MAX_CHARS = 8_000;

export type RunStatus = "idle" | "preview" | "running" | "success" | "error" | "cancelled";
export type StepStatus = "pending" | "running" | "done" | "skipped" | "error";

/** A safe failure: a stable code and a message we wrote ourselves. */
export interface RunError {
    code: string;
    message: string;
}

export interface StepRunState {
    id: string;
    label?: string;
    status: StepStatus;
    error?: RunError;
}

export interface RuntimeSnapshot {
    status: RunStatus;
    /** True when inputs changed after a successful run. */
    stale: boolean;
    /** Step state in blueprint order. */
    steps: StepRunState[];
    answers: Record<string, Record<string, Answer>>;
    vars: Record<string, unknown>;
    warnings: string[];
    error?: RunError;
    /** Determines `pick` and `palette`; stable for the same inputs. */
    seed: string;
    durationMs?: number;
}

/**
 * One decide call. The connection layer adapts itself to this: a guest proxy,
 * a local endpoint, or a server-owned connection. The runner adds its own
 * per-step timeout and abort signal, so implementations should honour both.
 */
export type DecideTransport = (
    request: DecideRequest,
    options: { signal: AbortSignal }
) => Promise<DecideResponse>;

export interface RunnerOptions {
    blueprint: Blueprint;
    /** Overrides the declared defaults, e.g. from `?word=...`. */
    inputs?: Record<string, unknown>;
    decide?: DecideTransport;
    /** Overrides the input hash for deterministic art. */
    seed?: string | number;
    timeoutMs?: number;
    /** Defaults to true when the blueprint has a preview. */
    preview?: boolean;
    now?: () => number;
}

interface RunFailure extends Error {
    code: string;
}

const isRunFailure = (error: unknown): error is RunFailure =>
    error instanceof Error && typeof (error as { code?: unknown }).code === "string";

/* -------------------------------------------------------------------------- */
/* Safe messages                                                              */
/* -------------------------------------------------------------------------- */

const MESSAGES: Record<string, string> = {
    cancelled: "The run was cancelled.",
    timeout: "The model took too long to answer.",
    no_connection: "Connect a model before running this app.",
    unreachable: "Could not reach the model connection.",
    auth: "That connection was rejected. Check the key and try again.",
    rate_limit: "Too many requests. Wait a moment, then run it again.",
    quota: "That connection is out of quota.",
    validation: "The connection rejected the request.",
    unsupported: "That connection cannot answer these questions.",
    upstream: "The model provider returned an error.",
    too_large: "The response was too large to read.",
    malformed: "The model returned an answer JEVIL could not read.",
    invalid: "That connection is not valid.",
    internal: "Something went wrong on our side.",
    state_too_large: "This step's state is too long to send.",
    state_invalid: "This step's state could not be read.",
    missing_answers: "The model did not answer every question.",
    unexpected: "Something went wrong during the run."
};

const failure = (code: string): RunFailure =>
    Object.assign(new Error(MESSAGES[code] ?? MESSAGES.unexpected), { code });

const safeError = (error: unknown): RunError => {
    if (isRunFailure(error)) {
        const code = error.code in MESSAGES ? error.code : "unexpected";
        return { code, message: MESSAGES[code]! };
    }

    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code === "string" && code in MESSAGES) {
        return { code, message: MESSAGES[code]! };
    }

    return { code: "unexpected", message: MESSAGES.unexpected! };
};

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

const inputDefault = (input: AppInput): InputValue => {
    if (input.default !== undefined) return input.default;
    if (input.type === "toggle") return false;
    if (input.type === "slider") return input.min ?? 0;
    if (input.type === "select") return input.options?.[0]?.value ?? "";
    return "";
};

const clampNumber = (value: number, input: AppInput): number => {
    const min = input.min ?? Number.NEGATIVE_INFINITY;
    const max = input.max ?? Number.POSITIVE_INFINITY;
    return Math.min(max, Math.max(min, value));
};

/** Coerce a URL value or a `set` action to the declared input type. */
export const coerceInput = (input: AppInput, raw: unknown): InputValue => {
    if (raw === undefined || raw === null) return inputDefault(input);

    if (input.type === "toggle") {
        if (typeof raw === "boolean") return raw;
        if (raw === "true" || raw === "1" || raw === 1) return true;
        if (raw === "false" || raw === "0" || raw === 0) return false;
        return inputDefault(input);
    }

    if (input.type === "slider") {
        const number = typeof raw === "number" ? raw : Number(raw);
        if (!Number.isFinite(number)) return inputDefault(input);
        return clampNumber(number, input);
    }

    if (typeof raw === "boolean") return inputDefault(input);
    const text = typeof raw === "string" ? raw : textOf(raw);
    const limit = input.maxLength ?? 4000;
    const trimmed = text.slice(0, limit);

    if (input.type === "select") {
        const allowed = input.options?.some((option) => option.value === trimmed) ?? false;
        return allowed ? trimmed : inputDefault(input);
    }

    if (input.type === "color") {
        return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toLowerCase() : inputDefault(input);
    }

    return trimmed;
};

/** Every declared input with its default, then the caller's overrides. */
export const initialInputs = (
    blueprint: Blueprint,
    overrides: Record<string, unknown> = {}
): Record<string, InputValue> => {
    const inputs: Record<string, InputValue> = {};

    for (const input of blueprint.inputs) {
        inputs[input.id] =
            input.id in overrides ? coerceInput(input, overrides[input.id]) : inputDefault(input);
    }

    return inputs;
};

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

const decideQuestions = (questions: Record<string, AppQuestion>): Record<string, Question> => {
    const result: Record<string, Question> = {};

    for (const [id, question] of Object.entries(questions)) {
        result[id] =
            question.type === "choice"
                ? {
                      type: "choice",
                      instructions: question.instructions,
                      criteria: question.criteria
                  }
                : question.type === "score"
                  ? {
                        type: "score",
                        instructions: question.instructions,
                        criteria: question.criteria
                    }
                  : { type: "noul", instructions: question.instructions };
    }

    return result;
};

/** `when` is boolean by validation; numbers and missing answers are tolerated. */
const gateOpen = (binding: Binding, scope: RuntimeScope, warnings: string[]): boolean => {
    const value = resolveBinding(binding, scope);

    if (value === undefined || value === null) return false;
    if (typeof value === "boolean") return value;

    warnings.push("`when` resolved to a non-boolean; used its truthiness");
    return Boolean(value);
};

const stateOf = (binding: Binding, scope: RuntimeScope): string => {
    const value = resolveBinding(binding, scope);

    let state: string;
    if (typeof value === "string") state = value;
    else if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        try {
            state = JSON.stringify(value);
        } catch {
            throw failure("state_invalid");
        }
    } else {
        throw failure("state_invalid");
    }

    if (state.length > STATE_MAX_CHARS) throw failure("state_too_large");
    return state;
};

/** A response must answer every question; extras are harmless. */
const checkAnswers = (response: DecideResponse, step: DecideStep): void => {
    for (const question of Object.keys(step.questions)) {
        if (!(question in response.answers)) throw failure("missing_answers");
    }
};

/* -------------------------------------------------------------------------- */
/* Runner                                                                     */
/* -------------------------------------------------------------------------- */

type Listener = (snapshot: RuntimeSnapshot) => void;

const cloneAnswers = (
    answers: Record<string, Record<string, Answer>>
): Record<string, Record<string, Answer>> => {
    const copy: Record<string, Record<string, Answer>> = {};
    for (const [step, byQuestion] of Object.entries(answers)) {
        copy[step] = { ...byQuestion };
    }
    return copy;
};

export class BlueprintRunner {
    private readonly blueprint: Blueprint;
    private readonly timeoutMs: number;
    private readonly now: () => number;
    private readonly previewEnabled: boolean;
    private transport?: DecideTransport;
    private listeners = new Set<Listener>();
    private controller?: AbortController;
    private running?: Promise<RuntimeSnapshot>;
    private cancelRequested = false;
    private explicitSeed?: string | number;
    private snapshot: RuntimeSnapshot;

    constructor(options: RunnerOptions) {
        this.blueprint = options.blueprint;
        this.transport = options.decide;
        this.timeoutMs = options.timeoutMs ?? STEP_TIMEOUT_MS;
        this.now = options.now ?? (() => Date.now());
        this.explicitSeed = options.seed;

        const preview = options.preview ?? Boolean(this.blueprint.preview);
        this.previewEnabled = preview;
        const inputs = initialInputs(
            this.blueprint,
            preview
                ? { ...this.blueprint.preview?.inputs, ...options.inputs }
                : (options.inputs ?? {})
        );
        const answers = preview ? cloneAnswers(this.blueprint.preview?.answers ?? {}) : {};

        this.snapshot = this.buildSnapshot({
            status: preview ? "preview" : "idle",
            inputs,
            answers,
            warnings: []
        });
    }

    /* -- state -------------------------------------------------------------- */

    getSnapshot = (): RuntimeSnapshot => this.snapshot;

    /** Working inputs; useful for controlled fields. */
    get inputValues(): Record<string, InputValue> {
        return { ...this.inputs };
    }

    private inputs: Record<string, InputValue> = {};
    private answers: Record<string, Record<string, Answer>> = {};
    /** Bumped by `reset()` so a run that was in flight cannot publish over it. */
    private generation = 0;

    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    setTransport(transport: DecideTransport | undefined): void {
        this.transport = transport;
    }

    /** True while a run is in flight. */
    get busy(): boolean {
        return this.running !== undefined;
    }

    /**
     * Change one or more inputs. Values are coerced to the declared type;
     * unknown ids are ignored. A successful result becomes stale.
     */
    setInputs(patch: Record<string, unknown>): void {
        const next = { ...this.inputs };
        let changed = false;

        for (const input of this.blueprint.inputs) {
            if (!(input.id in patch)) continue;
            const value = coerceInput(input, patch[input.id]);
            if (next[input.id] !== value) {
                next[input.id] = value;
                changed = true;
            }
        }

        if (!changed) return;

        this.inputs = next;
        const stale = this.snapshot.status === "success" || this.snapshot.status === "cancelled";
        this.publish({ stale });
    }

    setInput(id: string, value: unknown): void {
        this.setInputs({ [id]: value });
    }

    /** Defaults and the preview state when one exists, with no user answers. */
    reset(): void {
        this.generation += 1;
        this.abort();

        const preview = this.previewEnabled;
        this.inputs = initialInputs(
            this.blueprint,
            preview ? this.blueprint.preview?.inputs : undefined
        );
        this.answers = preview ? cloneAnswers(this.blueprint.preview?.answers ?? {}) : {};

        this.publish({
            status: preview ? "preview" : "idle",
            stale: false,
            error: undefined,
            durationMs: undefined,
            warnings: [],
            steps: this.blueprint.steps.map((step) => ({
                id: step.id,
                ...(step.label ? { label: step.label } : {}),
                status:
                    preview && this.blueprint.preview?.answers?.[step.id]
                        ? ("done" as const)
                        : ("pending" as const)
            }))
        });
    }

    /* -- run ---------------------------------------------------------------- */

    /**
     * Execute every step in order. Idempotent while running: the in-flight run
     * is returned instead of starting a second one.
     */
    run(): Promise<RuntimeSnapshot> {
        if (this.running) return this.running;

        this.running = this.execute().finally(() => {
            this.running = undefined;
            this.controller = undefined;
            this.cancelRequested = false;
        });

        return this.running;
    }

    /** Abort the in-flight request; completed answers stay visible. */
    cancel(): void {
        if (!this.running) return;
        this.cancelRequested = true;
        this.controller?.abort();
    }

    private abort(): void {
        this.cancelRequested = true;
        this.controller?.abort();
    }

    private async execute(): Promise<RuntimeSnapshot> {
        const controller = new AbortController();
        this.controller = controller;
        this.cancelRequested = false;
        const startedAt = this.now();
        const generation = this.generation;

        this.publish({
            status: "running",
            stale: false,
            error: undefined,
            durationMs: undefined,
            warnings: []
        });

        if (!this.transport) {
            return this.fail(failure("no_connection"), undefined, startedAt);
        }

        const warnings: string[] = [];

        for (const [index, step] of this.blueprint.steps.entries()) {
            if (generation !== this.generation) return this.snapshot;
            if (controller.signal.aborted) {
                return this.cancelled(startedAt);
            }

            this.setStepStatus(index, "running");
            this.publish({ warnings: [...warnings] });

            const scope = this.scope();

            if (step.when && !gateOpen(step.when, scope, warnings)) {
                this.setStepStatus(index, "skipped");
                this.publish({ warnings: [...warnings] });
                continue;
            }

            let state: string;
            try {
                state = stateOf(step.state, scope);
            } catch (error) {
                return this.fail(error, index, startedAt);
            }

            const request = decideRequestSchema.safeParse({
                state,
                questions: decideQuestions(step.questions),
                ...(step.model ? { model: step.model } : {})
            });

            if (!request.success) {
                return this.fail(failure("validation"), index, startedAt);
            }

            let response: DecideResponse;
            try {
                response = await this.callStep(request.data, controller.signal);
            } catch (error) {
                if (generation !== this.generation) return this.snapshot;
                if (this.cancelRequested || controller.signal.aborted) {
                    return this.cancelled(startedAt);
                }
                return this.fail(error, index, startedAt);
            }

            if (generation !== this.generation) return this.snapshot;
            if (controller.signal.aborted) return this.cancelled(startedAt);

            const parsed = decideResponseSchema.safeParse(response);
            if (!parsed.success) return this.fail(failure("malformed"), index, startedAt);

            try {
                checkAnswers(parsed.data, step);
            } catch (error) {
                return this.fail(error, index, startedAt);
            }

            this.answers = { ...this.answers, [step.id]: { ...parsed.data.answers } };
            this.setStepStatus(index, "done");
            this.publish({ warnings: [...warnings] });
        }

        if (generation !== this.generation) return this.snapshot;

        const durationMs = this.now() - startedAt;
        this.publish({
            status: "success",
            stale: false,
            error: undefined,
            durationMs,
            warnings: [...warnings]
        });

        return this.snapshot;
    }

    /** One transport call, bounded by the step timeout and the run signal. */
    private async callStep(
        request: DecideRequest,
        runSignal: AbortSignal
    ): Promise<DecideResponse> {
        const transport = this.transport;
        if (!transport) throw failure("no_connection");
        if (runSignal.aborted) throw failure("cancelled");

        const controller = new AbortController();
        const forward = (): void => controller.abort();
        runSignal.addEventListener("abort", forward, { once: true });

        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, this.timeoutMs);

        try {
            return await transport(request, { signal: controller.signal });
        } catch (error) {
            if (timedOut) throw failure("timeout");
            if (controller.signal.aborted && !runSignal.aborted) throw failure("cancelled");
            if (isRunFailure(error)) throw error;
            if (error instanceof Error && error.name === "AbortError") throw failure("cancelled");
            throw error;
        } finally {
            clearTimeout(timer);
            runSignal.removeEventListener("abort", forward);
        }
    }

    /* -- helpers ------------------------------------------------------------ */

    private scope(): RuntimeScope {
        return {
            inputs: this.inputs,
            answers: this.answers,
            vars: this.snapshot.vars,
            meta: this.blueprint.meta,
            seed: this.explicitSeed ?? inputSeed(this.inputs)
        };
    }

    private setStepStatus(index: number, status: StepStatus, error?: RunError): void {
        if (index < 0) return;
        const steps = this.snapshot.steps.map((step, position) =>
            position === index
                ? { ...step, status, ...(error ? { error } : { error: undefined }) }
                : step
        );
        this.snapshot = { ...this.snapshot, steps };
    }

    private cancelled(startedAt: number): RuntimeSnapshot {
        const error = safeError(failure("cancelled"));
        const index = this.snapshot.steps.findIndex((step) => step.status === "running");
        this.setStepStatus(index, "error", error);
        this.publish({
            status: "cancelled",
            stale: false,
            error,
            durationMs: this.now() - startedAt
        });
        return this.snapshot;
    }

    private fail(error: unknown, index: number | undefined, startedAt: number): RuntimeSnapshot {
        const safe = safeError(error);
        if (index !== undefined) this.setStepStatus(index, "error", safe);
        this.publish({
            status: "error",
            stale: false,
            error: safe,
            durationMs: this.now() - startedAt
        });
        return this.snapshot;
    }

    private buildSnapshot({
        status,
        inputs,
        answers,
        warnings
    }: {
        status: RunStatus;
        inputs: Record<string, InputValue>;
        answers: Record<string, Record<string, Answer>>;
        warnings: string[];
    }): RuntimeSnapshot {
        this.inputs = inputs;
        this.answers = answers;
        const seed = String(this.explicitSeed ?? inputSeed(inputs));
        const evaluated = evaluateVars(this.blueprint.vars, {
            inputs,
            answers,
            meta: this.blueprint.meta,
            seed
        });

        return {
            status,
            stale: false,
            steps: this.blueprint.steps.map((step) => ({
                id: step.id,
                ...(step.label ? { label: step.label } : {}),
                // A preview already has answers, so its steps are done, not pending.
                status:
                    status === "preview" && this.blueprint.preview?.answers?.[step.id]
                        ? "done"
                        : "pending"
            })),
            answers: cloneAnswers(answers),
            vars: evaluated.values,
            warnings: [...warnings, ...evaluated.warnings],
            seed
        };
    }

    /** Merge a patch into the snapshot, re-evaluating vars when answers change. */
    private publish(patch: Partial<RuntimeSnapshot> & { warnings?: string[] }): void {
        const next: RuntimeSnapshot = {
            ...this.snapshot,
            ...patch,
            answers: cloneAnswers(this.answers)
        };

        const seed = String(this.explicitSeed ?? inputSeed(this.inputs));
        const evaluated = evaluateVars(this.blueprint.vars, {
            inputs: this.inputs,
            answers: this.answers,
            meta: this.blueprint.meta,
            seed
        });

        next.vars = evaluated.values;
        next.seed = seed;
        next.warnings = [
            ...new Set([...(patch.warnings ?? this.snapshot.warnings), ...evaluated.warnings])
        ];
        this.snapshot = next;

        for (const listener of this.listeners) {
            try {
                listener(next);
            } catch {
                // A broken listener must not break a run.
            }
        }
    }
}

export const createRunner = (options: RunnerOptions): BlueprintRunner =>
    new BlueprintRunner(options);
