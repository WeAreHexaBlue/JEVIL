/**
 * Shared provider plumbing (SPEC §10.1 and §10.3).
 *
 * Adapters call `fetchJson` for transport safety and `normalizeAnswers` to turn
 * a provider's answer map into the shared contract in `src/lib/decide/types.ts`.
 * Nothing here knows a provider's URL, auth, or payload shape.
 */

import type { DecideRequest, DecideResponse, Question } from "#lib/decide/types";
import {
    isRecord,
    normalizeAnswers as normalizeCore,
    type NormalizeOptions,
    type NormalizeResult
} from "#lib/decide/normalize";
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

/**
 * Server-side wrapper: keep the shared normalization and log dropped answers.
 * Passing `onDrop` overrides the log, which tests and some callers do.
 */
export const normalizeAnswers = (
    rawAnswers: unknown,
    questions: Record<string, Question>,
    {
        onDrop = (questionId: string) => logEvent("warn", "decide_answer_dropped", { questionId })
    }: NormalizeOptions = {}
): NormalizeResult => normalizeCore(rawAnswers, questions, { onDrop });

export type { NormalizeResult } from "#lib/decide/normalize";

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
    model,
    bodyModel,
    unwrap
}: {
    url: string;
    headers?: Record<string, string>;
    ctx: DecideContext;
    req: DecideRequest;
    model?: string;
    /** Provider-specific body selector when it differs from the path model. */
    bodyModel?: string;
    /** Unwrap a provider envelope before parsing the System One payload. */
    unwrap?: (payload: unknown) => unknown;
}): Promise<DecideResponse> => {
    const selected = bodyModel ?? model;
    const body = selected ? { ...req, model: selected } : req;
    const payload = await fetchJson(url, {
        method: "POST",
        headers,
        body,
        signal: ctx.signal
    });

    return parseDecideResponse(
        unwrap ? unwrap(payload) : payload,
        req.questions,
        model ?? "unknown"
    );
};
