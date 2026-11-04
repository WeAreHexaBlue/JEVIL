/**
 * The decide transport (SPEC §8.3 and §10).
 *
 * Account connections decrypt on the server; guest connections arrive as
 * ephemeral headers and are never persisted. Both paths funnel into the same
 * adapter call and the same client response: normalized answers without the
 * provider's raw payload.
 */

import { z } from "zod";
import { decideRequestSchema, type DecideRequest, type DecideResponse } from "#lib/decide/types";
import { providerIdSchema } from "#lib/schema/primitives";
import { ConnectionError } from "./connections";
import { getAdapter } from "./providers";
import { ProviderError, type ResolvedConnection } from "./providers/base";
import { checkEndpointUrl, type EndpointPolicy } from "./ssrf";

/** Account decide body: the shared request plus the connection to use. */
export const accountDecideSchema = decideRequestSchema.extend({
    connectionId: z.string().min(1).max(64)
});

export type AccountDecideInput = z.infer<typeof accountDecideSchema>;

/** What a caller receives. `_raw` never leaves the server. */
export interface DecideResult {
    model: string;
    answers: DecideResponse["answers"];
    usage?: DecideResponse["usage"];
    meta?: DecideResponse["meta"];
}

export const toClientResult = (response: DecideResponse): DecideResult => {
    const result: DecideResult = { model: response.model, answers: response.answers };
    if (response.usage) result.usage = response.usage;
    if (response.meta) result.meta = response.meta;
    return result;
};

export const addUsage = (usage: DecideResponse["usage"]): number => {
    if (!usage) return 0;
    if (usage.billed_tokens !== undefined) return usage.billed_tokens;
    return (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
};

/** HTTP status for a provider failure. The code stays in the body. */
export const statusForProviderError = (code: ProviderError["code"]): number => {
    switch (code) {
        case "auth":
            return 401;
        case "rate_limit":
            return 429;
        case "quota":
            return 402;
        case "validation":
        case "unsupported":
            return 400;
        case "timeout":
            return 504;
        default:
            return 502;
    }
};

const guestHeader = (headers: Headers, name: string): string => (headers.get(name) ?? "").trim();

/**
 * Turn ephemeral guest headers into a resolved connection.
 *
 * A guest request never gets a local endpoint: those must be called directly
 * by the browser, so the server cannot be used to probe the user's network.
 */
export const guestConnection = (headers: Headers, policy: EndpointPolicy): ResolvedConnection => {
    const provider = providerIdSchema.safeParse(guestHeader(headers, "x-jevil-provider"));
    if (!provider.success) {
        throw new ConnectionError("invalid", "Choose a provider");
    }

    const baseUrl = guestHeader(headers, "x-jevil-base-url");
    const model = guestHeader(headers, "x-jevil-model");
    const key = guestHeader(headers, "x-jevil-key");
    const accountId = guestHeader(headers, "x-jevil-account-id");

    if (provider.data === "systemone") {
        throw new ConnectionError(
            "invalid",
            "Local endpoints are called directly from the browser"
        );
    }

    if (baseUrl.length > 0) {
        const checked = checkEndpointUrl(baseUrl, {
            production: policy.production,
            allowLocal: false
        });
        if (!checked.ok) throw new ConnectionError("invalid", checked.message);
    }

    if (!key) throw new ConnectionError("invalid", "This provider needs a credential");

    if (accountId.length > 0 && !/^[A-Za-z0-9_-]{1,64}$/.test(accountId)) {
        throw new ConnectionError("invalid", "That Cloudflare account id is not valid");
    }

    return {
        provider: provider.data,
        baseUrl,
        model: model.length > 0 ? model : undefined,
        config: accountId.length > 0 ? { accountId } : {},
        secret: key
    };
};

/** One adapter call. Callers own the abort signal and the error mapping. */
export const runDecide = async (
    connection: ResolvedConnection,
    request: DecideRequest,
    signal: AbortSignal
): Promise<DecideResponse> =>
    getAdapter(connection.provider).decide({ connection, signal }, request);

/** Rate-limit keys are stable strings, never raw IPs. */
export const subjectFor = (kind: "user" | "ip" | "connection", value: string): string =>
    `${kind}:${value}`;

export const hashIp = async (ip: string): Promise<string> => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
    return Array.from(new Uint8Array(digest))
        .slice(0, 8)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
};
