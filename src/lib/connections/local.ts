/**
 * Direct local-endpoint transport (SPEC §10.5 and §10.7).
 *
 * A model on the user's machine is called by the browser, not the Worker.
 * This module runs client-side only: no secret crosses the JEVIL server, and
 * a CORS block shows up as `unreachable` instead of a server error.
 */

import { normalizeAnswers } from "#lib/decide/normalize";
import type { DecideRequest, DecideResponse } from "#lib/decide/types";
import { usageSchema } from "#lib/decide/types";

export const LOCAL_TIMEOUT_MS = 15_000;
export const LOCAL_MAX_BYTES = 256 * 1024;

export type LocalErrorCode =
    | "unreachable"
    | "timeout"
    | "auth"
    | "rate_limit"
    | "quota"
    | "validation"
    | "upstream"
    | "too_large"
    | "malformed";

/** A local request failure with a stable code and no response body. */
export class LocalDecideError extends Error {
    readonly code: LocalErrorCode;
    readonly status?: number;

    constructor(code: LocalErrorCode, message: string, status?: number) {
        super(message);
        this.name = "LocalDecideError";
        this.code = code;
        this.status = status;
    }
}

export interface LocalConnection {
    baseUrl: string;
    model?: string;
    secret?: string;
    /** Send the secret in this header instead of `Authorization: Bearer`. */
    headerName?: string;
}

export interface LocalDecideOptions {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    timeoutMs?: number;
    maxBytes?: number;
}

const statusCode = (status: number): LocalErrorCode => {
    if (status === 401 || status === 403) return "auth";
    if (status === 402) return "quota";
    if (status === 429) return "rate_limit";
    if (status === 408) return "timeout";
    if (status === 400 || status === 409 || status === 422) return "validation";
    return "upstream";
};

const joinUrl = (baseUrl: string, path: string): string =>
    `${baseUrl.trim().replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * True for an endpoint on the user's own machine, which the server can never
 * reach and must not proxy. Anything unparsable is not local.
 */
export const isLocalEndpoint = (baseUrl: string): boolean => {
    try {
        return loopbackHosts.has(new URL(baseUrl.trim()).hostname.toLowerCase());
    } catch {
        return false;
    }
};

const authHeaders = (connection: LocalConnection): Record<string, string> => {
    const secret = connection.secret?.trim();
    if (!secret) return {};

    const headerName = connection.headerName?.trim();
    if (headerName) {
        if (!/^[A-Za-z0-9-]+$/.test(headerName)) {
            throw new LocalDecideError("validation", "That header name is not valid");
        }
        return { [headerName]: secret };
    }

    return { authorization: `Bearer ${secret}` };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * POST to `<baseUrl>/v1/decide` and normalize the answers.
 *
 * Errors never include the response body, the key, or request headers. A
 * `TypeError` from fetch is reported as `unreachable`, which is what a CORS
 * rejection or a stopped server both look like to the browser.
 */
export const decideLocal = async (
    connection: LocalConnection,
    request: DecideRequest,
    {
        fetchImpl = fetch,
        signal,
        timeoutMs = LOCAL_TIMEOUT_MS,
        maxBytes = LOCAL_MAX_BYTES
    }: LocalDecideOptions = {}
): Promise<DecideResponse> => {
    const baseUrl = connection.baseUrl.trim();
    if (!baseUrl) throw new LocalDecideError("validation", "This connection has no URL");

    if (signal?.aborted) throw new LocalDecideError("timeout", "The request was cancelled");

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
        response = await fetchImpl(joinUrl(baseUrl, "/v1/decide"), {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                ...authHeaders(connection)
            },
            body: JSON.stringify(
                connection.model ? { ...request, model: connection.model } : request
            ),
            redirect: "manual",
            signal: controller.signal
        });
    } catch (error) {
        if (timedOut) throw new LocalDecideError("timeout", "The local endpoint timed out");
        if (error instanceof LocalDecideError) throw error;
        throw new LocalDecideError("unreachable", "Could not reach the local endpoint");
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
    }

    if (response.status >= 300 && response.status < 400) {
        throw new LocalDecideError(
            "upstream",
            "The local endpoint tried to redirect",
            response.status
        );
    }

    if (!response.ok) {
        const code = statusCode(response.status);
        throw new LocalDecideError(
            code,
            `The local endpoint returned HTTP ${response.status}`,
            response.status
        );
    }

    const declared = Number(response.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(declared) && declared > maxBytes) {
        throw new LocalDecideError("too_large", "The local response was too large");
    }

    let text: string;
    try {
        text = await response.text();
    } catch {
        if (timedOut) throw new LocalDecideError("timeout", "The local endpoint timed out");
        throw new LocalDecideError("unreachable", "Could not read the local response");
    }

    if (new TextEncoder().encode(text).byteLength > maxBytes) {
        throw new LocalDecideError("too_large", "The local response was too large");
    }

    let payload: unknown;
    try {
        payload = JSON.parse(text);
    } catch {
        throw new LocalDecideError("malformed", "The local endpoint did not return JSON");
    }

    if (!isRecord(payload) || !isRecord(payload.answers)) {
        throw new LocalDecideError("malformed", "The local endpoint returned no answers");
    }

    const { answers } = normalizeAnswers(payload.answers, request.questions);
    const model =
        typeof payload.model === "string" && payload.model.trim().length > 0
            ? payload.model
            : (connection.model ?? "local");

    const result: DecideResponse = { model, answers };

    const usage = usageSchema.safeParse(payload.usage);
    if (usage.success) result.usage = usage.data;
    if (isRecord(payload.meta)) result.meta = payload.meta;

    return result;
};
