import {
    joinUrl,
    postDecide,
    requireSecret,
    resolveBaseUrl,
    resolveModel,
    validateConfig,
    type DecideAdapter
} from "./base";

const BASE_URL = "https://api.layaaimodel.com";
const DEFAULT_MODEL = "convaiinnovations/laya";

/** Laya's hosted gateway. */
export const layaAdapter: DecideAdapter = {
    id: "laya",
    defaultBaseUrl: BASE_URL,
    defaultModel: DEFAULT_MODEL,
    models: ["convaiinnovations/laya", "convaiinnovations/laya-multilingual"],
    capabilities: ["text"],
    validate: async (connection) => validateConfig(connection, BASE_URL, DEFAULT_MODEL, ["text"]),
    decide: async (ctx, req) => {
        const secret = requireSecret(ctx.connection);
        const model = resolveModel(req.model, ctx.connection, DEFAULT_MODEL);

        return postDecide({
            url: joinUrl(resolveBaseUrl(ctx.connection, BASE_URL), "/v1/decide"),
            headers: { authorization: `Bearer ${secret}` },
            ctx,
            req,
            model
        });
    }
};
