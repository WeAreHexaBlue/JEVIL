/**
 * Account transport: the browser asks JEVIL to call a stored connection.
 *
 * The key never leaves the server (SPEC §10.4). The client only sends a
 * connection id, and the Worker decrypts the key, calls the provider, and
 * returns the normalized answers. This module mirrors the guest transports so
 * the runner can swap one for the other without knowing the difference: a
 * stable code on failure and no provider payload.
 */

import { decideResponseSchema, type DecideRequest, type DecideResponse } from "#lib/decide/types";

export const ACCOUNT_TIMEOUT_MS = 20_000;
export const ACCOUNT_MAX_BYTES = 256 * 1024;

export type AccountErrorCode =
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

/** A safe account failure: a stable code, a status, and no body. */
export class AccountDecideError extends Error {
    readonly code: AccountErrorCode;
    readonly status?: number;

    constructor(code: AccountErrorCode, message: string, status?: number) {
        super(message);
        this.name = "AccountDecideError";
        this.code = code;
        this.status = status;
    }
}

export interface AccountDecideOptions {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
    maxBytes?: number;
    /** Defaults to `/api/decide`. */
    endpoint?: string;
}

const KNOWN_CODES = new Set<AccountErrorCode>([
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

const statusCode = (status: number): AccountErrorCode => {
    if (status === 401 || status === 403) return "auth";
    if (status === 402) return "quota";
    if (status === 404) return "invalid";
    if (status === 413) return "too_large";
    if (status === 429) return "rate_limit";
    if (status === 504) return "timeout";
    if (status === 400 || status === 422) return "validation";
    if (status >= 500) return "upstream";
    return "internal";
};

const readErrorBody = (text: string): { code: AccountErrorCode; message: string } | null => {
    try {
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        const record = parsed as Record<string, unknown>;
        const code = record.error;
        if (typeof code !== "string" || !KNOWN_CODES.has(code as AccountErrorCode)) return null;
        const message =
            typeof record.message === "string" && record.message.length > 0
                ? record.message.slice(0, 200)
                : "The decide request failed";
        return { code: code as AccountErrorCode, message };
    } catch {
        return null;
    }
};

/**
 * POST a decide request for a stored connection.
 *
 * Errors never carry the key or the provider payload; the response is parsed
 * against the shared contract rather than trusted because our server sent it.
 */
export const decideViaAccount = async (
    connectionId: string,
    request: DecideRequest,
    {
        fetchImpl = fetch,
        signal,
        timeoutMs = ACCOUNT_TIMEOUT_MS,
        maxBytes = ACCOUNT_MAX_BYTES,
        endpoint = "/api/decide"
    }: AccountDecideOptions = {}
): Promise<DecideResponse> => {
    if (!connectionId) throw new AccountDecideError("invalid", "Choose a connection first");
    if (signal?.aborted) throw new AccountDecideError("timeout", "The request was cancelled");

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);

    const cancel = (): void => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });

    let response: Response;
    try {
        response = await fetchImpl(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ connectionId, ...request }),
            credentials: "same-origin",
            redirect: "manual",
            signal: controller.signal
        });
    } catch {
        if (timedOut) throw new AccountDecideError("timeout", "The decide request timed out");
        throw new AccountDecideError("unreachable", "Could not reach JEVIL");
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
    }

    if (response.status >= 300 && response.status < 400) {
        throw new AccountDecideError(
            "upstream",
            "The decide request tried to redirect",
            response.status
        );
    }

    let text: string;
    try {
        text = await response.text();
    } catch {
        if (timedOut) throw new AccountDecideError("timeout", "The decide request timed out");
        throw new AccountDecideError("unreachable", "Could not read the decide response");
    }

    if (new TextEncoder().encode(text).byteLength > maxBytes) {
        throw new AccountDecideError(
            "too_large",
            "The decide response was too large",
            response.status
        );
    }

    if (!response.ok) {
        const body = readErrorBody(text);
        throw new AccountDecideError(
            body?.code ?? statusCode(response.status),
            body?.message ?? `The decide request returned HTTP ${response.status}`,
            response.status
        );
    }

    let payload: unknown;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new AccountDecideError("malformed", "The decide request did not return JSON");
    }

    const parsed = decideResponseSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AccountDecideError(
            "malformed",
            "The decide request returned an unexpected payload"
        );
    }

    return parsed.data;
};
