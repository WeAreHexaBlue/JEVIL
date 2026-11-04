/**
 * Guest cloud transport: the browser sends a key once, to `/api/proxy/decide`,
 * in an ephemeral header (SPEC §10.5). The server forwards the call and never
 * writes a row. Local endpoints never take this path.
 */

import { decideResponseSchema, type DecideRequest, type DecideResponse } from "#lib/decide/types";
import type { GuestConnection } from "#lib/schema/guest";

export const PROXY_TIMEOUT_MS = 20_000;
export const PROXY_MAX_BYTES = 256 * 1024;

export type ProxyErrorCode =
    | "unreachable"
    | "timeout"
    | "auth"
    | "rate_limit"
    | "quota"
    | "validation"
    | "unsupported"
    | "upstream"
    | "too_large"
    | "malformed"
    | "invalid"
    | "internal";

/** A safe proxy failure: a stable code, a status, and no body. */
export class ProxyDecideError extends Error {
    readonly code: ProxyErrorCode;
    readonly status?: number;

    constructor(code: ProxyErrorCode, message: string, status?: number) {
        super(message);
        this.name = "ProxyDecideError";
        this.code = code;
        this.status = status;
    }
}

export interface ProxyDecideOptions {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
    maxBytes?: number;
    /** Defaults to `/api/proxy/decide`. */
    endpoint?: string;
}

const KNOWN_CODES = new Set<ProxyErrorCode>([
    "unreachable",
    "timeout",
    "auth",
    "rate_limit",
    "quota",
    "validation",
    "unsupported",
    "upstream",
    "too_large",
    "malformed",
    "invalid",
    "internal"
]);

const statusCode = (status: number): ProxyErrorCode => {
    if (status === 401 || status === 403) return "auth";
    if (status === 402) return "quota";
    if (status === 413) return "too_large";
    if (status === 429) return "rate_limit";
    if (status === 504) return "timeout";
    if (status === 400 || status === 422) return "validation";
    return "upstream";
};

const readErrorBody = (text: string): { code: ProxyErrorCode; message: string } | null => {
    try {
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        const record = parsed as Record<string, unknown>;
        const code = record.error;
        if (typeof code !== "string" || !KNOWN_CODES.has(code as ProxyErrorCode)) return null;
        const message =
            typeof record.message === "string" && record.message.length > 0
                ? record.message.slice(0, 200)
                : "The decide proxy rejected the request";
        return { code: code as ProxyErrorCode, message };
    } catch {
        return null;
    }
};

/** A guest connection must be cloud mode; local endpoints bypass the server. */
export const proxyHeaders = (connection: GuestConnection): Record<string, string> => {
    if (connection.mode !== "cloud") {
        throw new ProxyDecideError("invalid", "Local endpoints are called from the browser");
    }

    const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-jevil-provider": connection.provider
    };

    if (connection.baseUrl) headers["x-jevil-base-url"] = connection.baseUrl;
    if (connection.model) headers["x-jevil-model"] = connection.model;
    if (connection.secret) headers["x-jevil-key"] = connection.secret;
    if (connection.accountId) headers["x-jevil-account-id"] = connection.accountId;

    return headers;
};

/**
 * POST a decide request through the JEVIL proxy.
 *
 * Errors never carry the key or the provider payload. The response is parsed
 * against the shared contract rather than trusted because the server sent it.
 */
export const decideViaProxy = async (
    connection: GuestConnection,
    request: DecideRequest,
    {
        fetchImpl = fetch,
        signal,
        timeoutMs = PROXY_TIMEOUT_MS,
        maxBytes = PROXY_MAX_BYTES,
        endpoint = "/api/proxy/decide"
    }: ProxyDecideOptions = {}
): Promise<DecideResponse> => {
    if (signal?.aborted) throw new ProxyDecideError("timeout", "The request was cancelled");

    const headers = proxyHeaders(connection);
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });

    let response: Response;
    try {
        response = await fetchImpl(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(request),
            redirect: "manual",
            signal: controller.signal
        });
    } catch {
        if (timedOut) throw new ProxyDecideError("timeout", "The decide proxy timed out");
        throw new ProxyDecideError("unreachable", "Could not reach the decide proxy");
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
    }

    if (response.status >= 300 && response.status < 400) {
        throw new ProxyDecideError(
            "upstream",
            "The decide proxy tried to redirect",
            response.status
        );
    }

    let text: string;
    try {
        text = await response.text();
    } catch {
        if (timedOut) throw new ProxyDecideError("timeout", "The decide proxy timed out");
        throw new ProxyDecideError("unreachable", "Could not read the decide response");
    }

    if (new TextEncoder().encode(text).byteLength > maxBytes) {
        throw new ProxyDecideError(
            "too_large",
            "The decide response was too large",
            response.status
        );
    }

    if (!response.ok) {
        const body = readErrorBody(text);
        throw new ProxyDecideError(
            body?.code ?? statusCode(response.status),
            body?.message ?? `The decide proxy returned HTTP ${response.status}`,
            response.status
        );
    }

    let payload: unknown;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new ProxyDecideError("malformed", "The decide proxy did not return JSON");
    }

    const parsed = decideResponseSchema.safeParse(payload);
    if (!parsed.success) {
        throw new ProxyDecideError("malformed", "The decide proxy returned an unexpected payload");
    }

    return parsed.data;
};
