import {
    joinUrl,
    postDecide,
    requireSecret,
    resolveBaseUrl,
    resolveModel,
    validateConfig,
    type DecideAdapter
} from "./base";

const BASE_URL = "https://clefdemo.com";
const DEFAULT_MODEL = "clef-omni";
const CAPABILITIES: DecideAdapter["capabilities"] = ["text", "image"];

/** Clef's hosted demo gateway. The path ends with a slash by design. */
export const clefAdapter: DecideAdapter = {
    id: "clef",
    defaultBaseUrl: BASE_URL,
    defaultModel: DEFAULT_MODEL,
    models: ["clef-omni", "clef", "clef-flash"],
    capabilities: CAPABILITIES,
    validate: async (connection) =>
        validateConfig(connection, BASE_URL, DEFAULT_MODEL, CAPABILITIES),
    decide: async (ctx, req) => {
        const secret = requireSecret(ctx.connection);
        const model = resolveModel(req.model, ctx.connection, DEFAULT_MODEL);

        return postDecide({
            url: joinUrl(resolveBaseUrl(ctx.connection, BASE_URL), "/v1/clef-omni/run/"),
            headers: { authorization: `Bearer ${secret}` },
            ctx,
            req,
            model
        });
    }
};
