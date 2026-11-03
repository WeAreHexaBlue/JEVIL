import {
    joinUrl,
    postDecide,
    requireSecret,
    resolveBaseUrl,
    resolveModel,
    validateConfig,
    type DecideAdapter
} from "./base";

const BASE_URL = "https://jevtypesafe.org";
const DEFAULT_MODEL = "jev";

/** Jev's hosted community endpoint. */
export const jevAdapter: DecideAdapter = {
    id: "jev",
    defaultBaseUrl: BASE_URL,
    defaultModel: DEFAULT_MODEL,
    models: ["jev", "openai-decisions"],
    capabilities: ["text"],
    validate: async (connection) => validateConfig(connection, BASE_URL, DEFAULT_MODEL, ["text"]),
    decide: async (ctx, req) => {
        const secret = requireSecret(ctx.connection);
        const model = resolveModel(req.model, ctx.connection, DEFAULT_MODEL);

        return postDecide({
            url: joinUrl(resolveBaseUrl(ctx.connection, BASE_URL), "/api/v1/decide"),
            headers: { authorization: `Bearer ${secret}` },
            ctx,
            req,
            model
        });
    }
};
