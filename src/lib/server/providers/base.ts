/**
 * Shared provider plumbing (SPEC §10.1 and §10.3).
 *
 * Adapters call `fetchJson` for transport safety and `normalizeAnswers` to turn
 * a provider's answer map into the shared contract in `src/lib/decide/types.ts`.
 * Nothing here knows a provider's URL, auth, or payload shape.
 */

import type { Answer, DecideRequest, DecideResponse, Question } from "#lib/decide/types";
import { usageSchema } from "#lib/decide/types";
import type { ProviderId } from "#lib/schema/primitives";
import { logEvent } from "#lib/server/log";

export const DEFAULT_TIMEOUT_MS = 15_000;
export const MAX_RESPONSE_BYTES = 256 * 1024;

export type ProviderErrorCode =
    | "auth"
    | "rate_limit"
    | "quota"
    | "validation"
    | "timeout"
    | "network"
    | "upstream"
    | "unsupported";

/**
 * A provider failure that is safe to show and log: a stable code plus a short
 * message. Never carry the response body, request headers, or the key.
 */
export class ProviderError extends Error {
    readonly code: ProviderErrorCode;
    readonly status?: number;

    constructor(code: ProviderErrorCode, message: string, status?: number) {
        super(message);
        this.name = "ProviderError";
        this.code = code;
        this.status = status;
    }
}

/** Map an HTTP status to a provider error code without reading the body. */
export const errorCodeForStatus = (status: number): ProviderErrorCode => {
    if (status === 401 || status === 403) return "auth";
    if (status === 402) return "quota";
    if (status === 429) return "rate_limit";
    if (status === 408) return "timeout";
    if (status === 400 || status === 409 || status === 422) return "validation";
    return "upstream";
};

export interface FetchJsonOptions {
    method?: string;
    headers?: Record<string, string>;
    /** Serialized as JSON when present. */
    body?: unknown;
    timeoutMs?: number;
    maxBytes?: number;
    signal?: AbortSignal;
    /** Injectable for tests; defaults to the global fetch. */
    fetchImpl?: typeof fetch;
}

const readCapped = async (response: Response, maxBytes: number): Promise<string> => {
    const declared = Number(response.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(declared) && declared > maxBytes) {
        throw new ProviderError("upstream", "Provider response was too large", response.status);
    }

    if (!response.body) return "";

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let text = "";

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel();
            throw new ProviderError("upstream", "Provider response was too large", response.status);
        }

        text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
};

/**
 * Fetch and parse JSON with a timeout, a response-size cap, and no redirects.
 * Errors are always `ProviderError`; their messages never include the body.
 */
export const fetchJson = async (
    url: string,
    {
        method = "GET",
        headers = {},
        body,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        maxBytes = MAX_RESPONSE_BYTES,
        signal,
        fetchImpl = fetch
    }: FetchJsonOptions = {}
): Promise<unknown> => {
    if (signal?.aborted) throw new ProviderError("timeout", "Provider request was cancelled");

    const controller = new AbortController();
    let timedOut = false;

    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });

    try {
        const response = await fetchImpl(url, {
            method,
            headers: {
                accept: "application/json",
                ...(body === undefined ? {} : { "content-type": "application/json" }),
                ...headers
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            redirect: "manual",
            signal: controller.signal
        });

        if (response.status >= 300 && response.status < 400) {
            throw new ProviderError(
                "upstream",
                "Provider tried to redirect the request",
                response.status
            );
        }

        if (!response.ok) {
            const code = errorCodeForStatus(response.status);
            throw new ProviderError(
                code,
                `Provider responded with HTTP ${response.status}`,
                response.status
            );
        }

        const text = await readCapped(response, maxBytes);
        if (text.length === 0) {
            throw new ProviderError(
                "upstream",
                "Provider returned an empty response",
                response.status
            );
        }

        try {
            return JSON.parse(text) as unknown;
        } catch {
            throw new ProviderError("upstream", "Provider returned invalid JSON", response.status);
        }
    } catch (error) {
        if (error instanceof ProviderError) throw error;

        if (timedOut) throw new ProviderError("timeout", "Provider request timed out");
        if (signal?.aborted || controller.signal.aborted) {
            throw new ProviderError("timeout", "Provider request was cancelled");
        }

        // A TypeError from fetch means the request never completed.
        throw new ProviderError("network", "Could not reach the provider");
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
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

/**
 * Turn a provider's answer map into the shared contract.
 *
 * - `choice`: the choice must be a criteria key; probabilities are normalized to
 *   sum to 1, and missing options become 0.
 * - `score`: probabilities may be keyed by level label or index, and are
 *   normalized into `score = Σ i·pᵢ / (n−1)`; without a distribution, the raw
 *   `level`/`score` is clamped into range and confidence is 0 (unknown).
 * - `noul`: accepts `noul` or `probability` and clamps to 0..1.
 *
 * One bad answer never fails the run: it is dropped and reported. By default a
 * dropped id is logged as a warning; pass `onDrop` in tests or callers that
 * report it elsewhere.
 */
export const normalizeAnswers = (
    rawAnswers: unknown,
    questions: Record<string, Question>,
    {
        onDrop = (questionId: string) => logEvent("warn", "decide_answer_dropped", { questionId })
    } = {}
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
            onDrop(questionId);
        }
    }

    return { answers, dropped };
};

/* -------------------------------------------------------------------------- */
/* Adapter contract                                                            */
/* -------------------------------------------------------------------------- */

export type ProviderCapability = "text" | "image" | "audio" | "video";

/** A connection after decryption, before an adapter touches it. */
export interface ResolvedConnection {
    provider: ProviderId;
    /** User-supplied or adapter-default endpoint. */
    baseUrl: string;
    model?: string;
    /** Non-secret provider config: `{ accountId }`, `{ headerName }`. */
    config?: Record<string, unknown>;
    /** Plaintext credential. Never log, return, or persist it. */
    secret?: string;
}

export interface DecideContext {
    connection: ResolvedConnection;
    signal: AbortSignal;
}

/** Result of a connection test. `error` is a provider code, never a payload. */
export interface ValidationResult {
    ok: boolean;
    model?: string;
    capabilities?: ProviderCapability[];
    error?: ProviderErrorCode;
}

export interface DecideAdapter {
    id: ProviderId;
    defaultBaseUrl: string;
    defaultModel?: string;
    models: string[];
    capabilities: ProviderCapability[];
    validate(connection: ResolvedConnection): Promise<ValidationResult>;
    decide(ctx: DecideContext, req: DecideRequest): Promise<DecideResponse>;
}

/** The credential, or a safe auth error. */
export const requireSecret = (connection: ResolvedConnection): string => {
    const secret = connection.secret?.trim();
    if (!secret) throw new ProviderError("auth", "This connection has no credential");
    return secret;
};

/** Join a base URL and a path without doubling or dropping the slash. */
export const joinUrl = (baseUrl: string, path: string): string =>
    `${baseUrl.trim().replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

/** Connection URL, falling back to the adapter default. */
export const resolveBaseUrl = (connection: ResolvedConnection, fallback: string): string => {
    const baseUrl = connection.baseUrl.trim() || fallback.trim();
    if (!baseUrl) throw new ProviderError("validation", "This connection has no endpoint URL");
    return baseUrl;
};

/** Model precedence: request, connection, adapter default. */
export const resolveModel = (
    requested: string | undefined,
    connection: ResolvedConnection,
    fallback: string | undefined
): string | undefined =>
    requested?.trim() || connection.model?.trim() || fallback?.trim() || undefined;

/**
 * Validate configuration for providers without a documented health endpoint.
 * A hosted provider is usable once it has a URL and a credential; the real
 * check is the first decide call.
 */
export const validateConfig = (
    connection: ResolvedConnection,
    fallbackBaseUrl: string,
    defaultModel: string,
    capabilities: ProviderCapability[]
): ValidationResult => {
    try {
        requireSecret(connection);
        resolveBaseUrl(connection, fallbackBaseUrl);
    } catch (error) {
        return {
            ok: false,
            error: error instanceof ProviderError ? error.code : "validation"
        };
    }

    return {
        ok: true,
        model: resolveModel(undefined, connection, defaultModel),
        capabilities
    };
};

/**
 * Turn a provider payload into the shared response: validate the envelope,
 * normalize answers, and keep the raw payload only in `_raw`.
 */
export const parseDecideResponse = (
    payload: unknown,
    questions: Record<string, Question>,
    fallbackModel: string
): DecideResponse => {
    if (!isRecord(payload)) {
        throw new ProviderError("upstream", "Provider returned an unexpected payload");
    }

    if (!isRecord(payload.answers)) {
        throw new ProviderError("upstream", "Provider returned no answers");
    }

    const { answers } = normalizeAnswers(payload.answers, questions);
    const model =
        typeof payload.model === "string" && payload.model.trim().length > 0
            ? payload.model
            : fallbackModel;

    const response: DecideResponse = { model, answers, _raw: payload };

    const usage = usageSchema.safeParse(payload.usage);
    if (usage.success) response.usage = usage.data;
    if (isRecord(payload.meta)) response.meta = payload.meta;

    return response;
};

/** POST a System One-shaped decide request and normalize the response. */
export const postDecide = async ({
    url,
    headers = {},
    ctx,
    req,
    model
}: {
    url: string;
    headers?: Record<string, string>;
    ctx: DecideContext;
    req: DecideRequest;
    model?: string;
}): Promise<DecideResponse> => {
    const body = model ? { ...req, model } : req;
    const payload = await fetchJson(url, {
        method: "POST",
        headers,
        body,
        signal: ctx.signal
    });

    return parseDecideResponse(payload, req.questions, model ?? "unknown");
};
