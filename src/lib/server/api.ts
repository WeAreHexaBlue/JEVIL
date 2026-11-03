/**
 * Small HTTP helpers for JSON API routes.
 *
 * Error bodies are stable codes plus a short message we wrote ourselves.
 * Nothing from a provider, a key, or a request body is echoed back.
 */

import type { RequestEvent } from "@sveltejs/kit";
import type { User } from "better-auth";
import { CryptoConfigError, DecryptionError } from "./crypto";
import { ConnectionError } from "./connections";
import { statusForProviderError } from "./decide";
import { ProviderError } from "./providers/base";
import { logEvent } from "./log";

export class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

const NO_STORE = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
};

export const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), { status, headers: NO_STORE });

export const fail = (status: number, code: string, message: string): Response =>
    json({ error: code, message }, status);

/** 429 with the wait clients should honor. */
export const rateLimited = (retryAfter: number): Response => {
    const response = fail(429, "rate_limit", "Too many requests. Try again shortly.");
    response.headers.set("retry-after", String(retryAfter));
    return response;
};

/** Signed-in user, or a 401 the client can act on. */
export const requireUser = (locals: App.Locals): User => {
    if (!locals.user) throw new ApiError(401, "unauthorized", "Sign in to manage connections");
    return locals.user;
};

/**
 * Cookie-authenticated writes must come from this origin. Browsers send
 * `Origin` on cross-origin fetch and form posts; an absent header is allowed
 * for same-origin GETs and non-browser clients that never send cookies.
 */
export const assertSameOrigin = (event: RequestEvent): void => {
    const origin = event.request.headers.get("origin");
    if (origin && origin !== event.url.origin) {
        throw new ApiError(403, "forbidden", "This request came from another origin");
    }
};

export const readJson = async (request: Request): Promise<unknown> => {
    try {
        return await request.json();
    } catch {
        throw new ApiError(400, "invalid", "Send a JSON body");
    }
};

/** Refuse oversized bodies before parsing them. */
export const assertBodyLimit = (request: Request, maxBytes: number): void => {
    const declared = Number(request.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(declared) && declared > maxBytes) {
        throw new ApiError(413, "too_large", "That request body is too large");
    }
};

/** Convert a thrown error into a safe response. Unknown errors are logged. */
export const apiError = (error: unknown): Response => {
    if (error instanceof ApiError) {
        return fail(error.status, error.code, error.message);
    }

    if (error instanceof ConnectionError) {
        return error.code === "not_found"
            ? fail(404, "not_found", error.message)
            : fail(400, "invalid", error.message);
    }

    if (error instanceof ProviderError) {
        const status = statusForProviderError(error.code);
        const response = fail(status, error.code, error.message);
        if (status === 429) response.headers.set("retry-after", "60");
        return response;
    }

    if (error instanceof DecryptionError) {
        logEvent("error", "connection_decrypt_failed");
        return fail(500, "decrypt_failed", "That credential could not be read");
    }

    if (error instanceof CryptoConfigError) {
        logEvent("error", "crypto_config_missing");
        return fail(500, "config", "Credential encryption is not configured");
    }

    logEvent("error", "api_unhandled", { name: error instanceof Error ? error.name : "unknown" });
    return fail(500, "internal", "Something went wrong");
};

/** Wrap a handler so every failure becomes JSON instead of an HTML page. */
export const handle =
    (handler: (event: RequestEvent) => Promise<unknown> | unknown) =>
    async (event: RequestEvent): Promise<Response> => {
        try {
            const result = await handler(event);
            return result instanceof Response ? result : json(result);
        } catch (error) {
            return apiError(error);
        }
    };
