import {
    joinUrl,
    postDecide,
    requireSecret,
    resolveBaseUrl,
    resolveModel,
    validateConfig,
    type DecideAdapter
} from "./base";

const BASE_URL = "https://api.typesafe.ai";
const DEFAULT_MODEL = "jev-latest";

/** TypeSafe's official Jev endpoint. */
export const jevAdapter: DecideAdapter = {
    id: "jev",
    defaultBaseUrl: BASE_URL,
    defaultModel: DEFAULT_MODEL,
    models: ["jev-latest", "jev-preview", "jev-1.14.0", "jev-1.13.0"],
    capabilities: ["text"],
    validate: async (connection) => validateConfig(connection, BASE_URL, DEFAULT_MODEL, ["text"]),
    decide: async (ctx, req) => {
        const secret = requireSecret(ctx.connection);
        const model = resolveModel(req.model, ctx.connection, DEFAULT_MODEL);

        return postDecide({
            url: joinUrl(resolveBaseUrl(ctx.connection, BASE_URL), "/v1/systemone"),
            headers: { authorization: `Bearer ${secret}` },
            ctx,
            req,
            model
        });
    }
};
