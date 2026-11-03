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
const DEFAULT_MODEL = "@cf/cloudflare/clef";
const CAPABILITIES: DecideAdapter["capabilities"] = ["text", "image"];

/** Workers AI needs an account id from the connection config. */
const requireAccountId = (config: Record<string, unknown> | undefined): string => {
    const accountId = config?.accountId;
    if (typeof accountId !== "string" || accountId.trim().length === 0) {
        throw new ProviderError("validation", "Cloudflare connections need an account id");
    }
    return accountId.trim();
};

/** Keep the model in one path shape and refuse anything that could break out. */
const modelPath = (model: string): string => {
    if (
        model.includes("..") ||
        model.startsWith("/") ||
        model.endsWith("/") ||
        !/^[A-Za-z0-9@/._-]+$/.test(model)
    ) {
        throw new ProviderError("validation", "That model id is not valid for Cloudflare");
    }
    return model;
};

/** Cloudflare Workers AI, one account per connection. */
export const cloudflareAdapter: DecideAdapter = {
    id: "cloudflare",
    defaultBaseUrl: BASE_URL,
    defaultModel: DEFAULT_MODEL,
    models: ["@cf/cloudflare/clef", "@cf/cloudflare/clef-flash"],
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
        const model = resolveModel(req.model, ctx.connection, DEFAULT_MODEL) ?? DEFAULT_MODEL;

        return postDecide({
            url: joinUrl(
                resolveBaseUrl(ctx.connection, BASE_URL),
                `/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelPath(model)}`
            ),
            headers: { authorization: `Bearer ${secret}` },
            ctx,
            req,
            model
        });
    }
};
