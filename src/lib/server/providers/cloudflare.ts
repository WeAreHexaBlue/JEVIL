import { isRecord } from "#lib/decide/normalize";
import {
    joinUrl,
    postDecide,
    ProviderError,
    requireSecret,
    resolveBaseUrl,
    resolveModel,
    validateConfig,
    type DecideAdapter
} from "./base";

const BASE_URL = "https://api.cloudflare.com";
const MODEL = "@cf/cloudflare/clef";
const MODEL_FLASH = "@cf/cloudflare/clef-flash";
const DEFAULT_MODEL = MODEL;
const CAPABILITIES: DecideAdapter["capabilities"] = ["text", "image"];

/** Workers AI needs an account id from the connection config. */
const requireAccountId = (config: Record<string, unknown> | undefined): string => {
    const accountId = config?.accountId;
    if (typeof accountId !== "string" || accountId.trim().length === 0) {
        throw new ProviderError("validation", "Cloudflare connections need an account id");
    }
    return accountId.trim();
};

/**
 * Workers AI takes the `@cf/...` id in the path and a short selector in the
 * body. Accept either spelling from the connection and normalize to the id.
 */
const normalizeModel = (raw: string | undefined): string => {
    const model = raw?.trim();
    if (!model || model === MODEL || model === "clef") return MODEL;
    if (model === MODEL_FLASH || model === "clef-flash") return MODEL_FLASH;
    throw new ProviderError("validation", "That model id is not valid for Cloudflare");
};

/** The body selector that pairs with a `@cf/...` model id. */
const bodyModel = (model: string): string => (model === MODEL_FLASH ? "clef-flash" : "clef");

/** Workers AI REST wraps the model output in `{ success, result }`. */
const unwrapWorkersAi = (payload: unknown): unknown => {
    if (!isRecord(payload)) {
        throw new ProviderError("upstream", "Provider returned an unexpected payload");
    }

    if (payload.success !== true || !isRecord(payload.result)) {
        throw new ProviderError("upstream", "Provider returned no answers");
    }

    return payload.result;
};

/** Cloudflare Workers AI, one account per connection. */
export const cloudflareAdapter: DecideAdapter = {
    id: "cloudflare",
    defaultBaseUrl: BASE_URL,
    defaultModel: DEFAULT_MODEL,
    models: [MODEL, MODEL_FLASH],
    capabilities: CAPABILITIES,
    validate: async (connection) => {
        try {
            requireSecret(connection);
            requireAccountId(connection.config);
        } catch (error) {
            return {
                ok: false,
                error: error instanceof ProviderError ? error.code : "validation"
            };
        }

        return validateConfig(connection, BASE_URL, DEFAULT_MODEL, CAPABILITIES);
    },
    decide: async (ctx, req) => {
        const secret = requireSecret(ctx.connection);
        const accountId = requireAccountId(ctx.connection.config);
        const model = normalizeModel(
            resolveModel(req.model, ctx.connection, DEFAULT_MODEL) ?? DEFAULT_MODEL
        );

        return postDecide({
            url: joinUrl(
                resolveBaseUrl(ctx.connection, BASE_URL),
                `/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`
            ),
            headers: { authorization: `Bearer ${secret}` },
            ctx,
            req,
            model,
            bodyModel: bodyModel(model),
            unwrap: unwrapWorkersAi
        });
    }
};
