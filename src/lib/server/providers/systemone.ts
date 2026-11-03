import {
    fetchJson,
    joinUrl,
    postDecide,
    ProviderError,
    resolveBaseUrl,
    resolveModel,
    type DecideAdapter,
    type ProviderCapability,
    type ResolvedConnection,
    type ValidationResult
} from "./base";

const ALL_CAPABILITIES: ProviderCapability[] = ["text", "image", "audio", "video"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const readCapabilities = (value: unknown): ProviderCapability[] | undefined =>
    Array.isArray(value)
        ? value.filter(
              (item): item is ProviderCapability =>
                  typeof item === "string" && (ALL_CAPABILITIES as string[]).includes(item)
          )
        : undefined;

/**
 * Auth for a custom endpoint: no secret, a bearer token, or a custom header
 * named in `config.headerName`.
 */
const authHeaders = (connection: ResolvedConnection): Record<string, string> => {
    const secret = connection.secret?.trim();
    if (!secret) return {};

    const configured = connection.config?.headerName;
    const headerName = typeof configured === "string" ? configured.trim() : "";

    if (headerName) {
        if (!/^[A-Za-z0-9-]+$/.test(headerName)) {
            throw new ProviderError("validation", "That header name is not valid");
        }
        return { [headerName]: secret };
    }

    return { authorization: `Bearer ${secret}` };
};

const failure = (error: unknown): ValidationResult => ({
    ok: false,
    error: error instanceof ProviderError ? error.code : "network"
});

/** Any endpoint implementing the System One HTTP contract (SPEC §10.4). */
export const systemoneAdapter: DecideAdapter = {
    id: "systemone",
    // The user supplies the URL; there is deliberately no remote default.
    defaultBaseUrl: "",
    models: [],
    capabilities: ["text"],
    validate: async (connection) => {
        let baseUrl: string;
        let headers: Record<string, string>;

        try {
            baseUrl = resolveBaseUrl(connection, "");
            headers = authHeaders(connection);
        } catch (error) {
            return failure(error);
        }

        try {
            const payload = await fetchJson(joinUrl(baseUrl, "/health"), { headers });

            if (!isRecord(payload) || payload.ok !== true) {
                return { ok: false, error: "upstream" };
            }

            return {
                ok: true,
                model: typeof payload.model === "string" ? payload.model : connection.model,
                capabilities: readCapabilities(payload.capabilities) ?? ["text"]
            };
        } catch (error) {
            return failure(error);
        }
    },
    decide: async (ctx, req) => {
        const baseUrl = resolveBaseUrl(ctx.connection, "");
        const model = resolveModel(req.model, ctx.connection, undefined);

        return postDecide({
            url: joinUrl(baseUrl, "/v1/decide"),
            headers: authHeaders(ctx.connection),
            ctx,
            req,
            model
        });
    }
};
