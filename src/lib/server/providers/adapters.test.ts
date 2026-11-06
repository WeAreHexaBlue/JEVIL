import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecideRequest } from "#lib/decide/types";
import {
    adapterList,
    clefAdapter,
    cloudflareAdapter,
    getAdapter,
    jevAdapter,
    layaAdapter,
    ProviderError,
    systemoneAdapter,
    type DecideAdapter,
    type ResolvedConnection
} from "./index";

let calls: Array<{ url: string; init: RequestInit }> = [];

const respond = (payload: unknown, status = 200): void => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify(payload), {
            status,
            headers: { "content-type": "application/json" }
        });
    });
};

const connection = (
    provider: ResolvedConnection["provider"],
    overrides: Partial<ResolvedConnection> = {}
): ResolvedConnection => ({
    provider,
    baseUrl: "",
    config: {},
    secret: "test-key",
    ...overrides
});

const decideRequest: DecideRequest = {
    state: "a moody forest",
    questions: {
        palette: {
            type: "choice",
            instructions: "Pick a palette.",
            criteria: { dusk: "Muted purples", dawn: "Warm pastels" }
        }
    }
};

const providerPayload = {
    model: "provider-model",
    answers: {
        palette: {
            choice: "dusk",
            confidence: 0.75,
            probabilities: { dusk: 0.75, dawn: 0.25 }
        }
    },
    usage: { input_tokens: 12, output_tokens: 3 },
    meta: { requestId: "req_1" }
};

const decide = (adapter: DecideAdapter, conn: ResolvedConnection, req = decideRequest) =>
    adapter.decide({ connection: conn, signal: new AbortController().signal }, req);

const providerError = async (request: Promise<unknown>): Promise<ProviderError> => {
    try {
        await request;
    } catch (error) {
        if (error instanceof ProviderError) return error;
        throw error;
    }
    throw new Error("expected the request to fail");
};

beforeEach(() => {
    calls = [];
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("hosted adapters", () => {
    const cases = [
        {
            adapter: jevAdapter,
            url: "https://api.typesafe.ai/v1/systemone",
            model: "jev-latest"
        },
        {
            adapter: layaAdapter,
            url: "https://laya-model.com/v1/decide",
            model: "english"
        },
        {
            adapter: clefAdapter,
            url: "https://clefdemo.com/v1/clef-omni/run/",
            model: "clef-omni"
        }
    ];

    for (const { adapter, url, model } of cases) {
        it(`${adapter.id} posts the decide request with a bearer key`, async () => {
            respond(providerPayload);

            const result = await decide(adapter, connection(adapter.id));

            expect(calls).toHaveLength(1);
            expect(calls[0].url).toBe(url);
            expect(calls[0].init.method).toBe("POST");
            expect((calls[0].init.headers as Record<string, string>).authorization).toBe(
                "Bearer test-key"
            );

            const body = JSON.parse(String(calls[0].init.body)) as DecideRequest;
            expect(body.model).toBe(model);
            expect(body.state).toBe("a moody forest");

            expect(result.model).toBe("provider-model");
            expect(result.answers.palette).toMatchObject({
                type: "choice",
                choice: "dusk",
                confidence: 0.75
            });
            expect(result.usage).toEqual({ input_tokens: 12, output_tokens: 3 });
            expect(result.meta).toEqual({ requestId: "req_1" });
            expect(result._raw).toMatchObject({ model: "provider-model" });
        });
    }

    it("joins a user base URL without doubling the slash", async () => {
        respond(providerPayload);

        await decide(clefAdapter, connection("clef", { baseUrl: "https://proxy.test/" }));

        expect(calls[0].url).toBe("https://proxy.test/v1/clef-omni/run/");
    });

    it("lets the request choose a model", async () => {
        respond(providerPayload);

        await decide(clefAdapter, connection("clef"), {
            ...decideRequest,
            model: "clef-flash"
        });

        const body = JSON.parse(String(calls[0].init.body)) as DecideRequest;
        expect(body.model).toBe("clef-flash");
    });

    it("maps Jev's old model alias to jev-latest", async () => {
        respond(providerPayload);

        await decide(jevAdapter, connection("jev"), {
            ...decideRequest,
            model: "jev"
        });

        const body = JSON.parse(String(calls[0].init.body)) as DecideRequest;
        expect(body.model).toBe("jev-latest");
    });

    it("rejects a connection without a key before calling the provider", async () => {
        const error = await providerError(decide(jevAdapter, connection("jev", { secret: "" })));

        expect(error.code).toBe("auth");
        expect(calls).toHaveLength(0);
    });

    it("reports a provider payload without answers as an upstream error", async () => {
        respond({ model: "jev" });

        const error = await providerError(decide(jevAdapter, connection("jev")));

        expect(error.code).toBe("upstream");
        expect(error.message).toContain("no answers");
    });

    it("validates configuration without a network call", async () => {
        await expect(jevAdapter.validate(connection("jev"))).resolves.toMatchObject({
            ok: true,
            model: "jev-latest"
        });

        await expect(jevAdapter.validate(connection("jev", { secret: "" }))).resolves.toEqual({
            ok: false,
            error: "auth"
        });

        expect(calls).toHaveLength(0);
    });
});

describe("cloudflareAdapter", () => {
    const workersAiPayload = {
        success: true,
        errors: [],
        messages: [],
        result: providerPayload
    };

    it("builds the account path and sends the model selector", async () => {
        respond(workersAiPayload);

        await decide(
            cloudflareAdapter,
            connection("cloudflare", { config: { accountId: "acct_123" } })
        );

        expect(calls[0].url).toBe(
            "https://api.cloudflare.com/client/v4/accounts/acct_123/ai/run/@cf/cloudflare/clef"
        );
        expect((calls[0].init.headers as Record<string, string>).authorization).toBe(
            "Bearer test-key"
        );

        const body = JSON.parse(String(calls[0].init.body)) as DecideRequest;
        expect(body.model).toBe("clef");
    });

    it("unwraps the Workers AI envelope", async () => {
        respond(workersAiPayload);

        const result = await decide(
            cloudflareAdapter,
            connection("cloudflare", { config: { accountId: "acct_123" } })
        );

        expect(result.answers.palette).toMatchObject({ choice: "dusk", confidence: 0.75 });
        expect(result._raw).toEqual(providerPayload);
    });

    it("uses a requested model in the path and the body", async () => {
        respond(workersAiPayload);

        await decide(
            cloudflareAdapter,
            connection("cloudflare", { config: { accountId: "acct_123" } }),
            { ...decideRequest, model: "@cf/cloudflare/clef-flash" }
        );

        expect(calls[0].url).toContain("/ai/run/@cf/cloudflare/clef-flash");
        const body = JSON.parse(String(calls[0].init.body)) as DecideRequest;
        expect(body.model).toBe("clef-flash");
    });

    it("accepts the short model selector", async () => {
        respond(workersAiPayload);

        await decide(
            cloudflareAdapter,
            connection("cloudflare", { config: { accountId: "acct_123" } }),
            { ...decideRequest, model: "clef-flash" }
        );

        expect(calls[0].url).toContain("/ai/run/@cf/cloudflare/clef-flash");
        const body = JSON.parse(String(calls[0].init.body)) as DecideRequest;
        expect(body.model).toBe("clef-flash");
    });

    it("reports a failed Workers AI envelope", async () => {
        respond({ success: false, errors: [{ code: 1000 }], result: null });

        const error = await providerError(
            decide(cloudflareAdapter, connection("cloudflare", { config: { accountId: "a" } }))
        );

        expect(error.code).toBe("upstream");
        expect(error.message).toContain("no answers");
    });

    it("requires an account id", async () => {
        await expect(cloudflareAdapter.validate(connection("cloudflare"))).resolves.toEqual({
            ok: false,
            error: "validation"
        });

        const error = await providerError(decide(cloudflareAdapter, connection("cloudflare")));
        expect(error.code).toBe("validation");
        expect(calls).toHaveLength(0);
    });

    it("rejects a model that could escape the path", async () => {
        const error = await providerError(
            decide(cloudflareAdapter, connection("cloudflare", { config: { accountId: "a" } }), {
                ...decideRequest,
                model: "../admin"
            })
        );

        expect(error.code).toBe("validation");
        expect(calls).toHaveLength(0);
    });
});

describe("systemoneAdapter", () => {
    it("calls a custom endpoint without auth when there is no secret", async () => {
        respond(providerPayload);

        await decide(
            systemoneAdapter,
            connection("systemone", { baseUrl: "http://localhost:8000", secret: "" })
        );

        expect(calls[0].url).toBe("http://localhost:8000/v1/decide");
        expect((calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();

        const body = JSON.parse(String(calls[0].init.body)) as DecideRequest;
        expect(body.model).toBeUndefined();
    });

    it("supports a bearer token and a custom header", async () => {
        respond(providerPayload);

        await decide(
            systemoneAdapter,
            connection("systemone", {
                baseUrl: "http://localhost:8000/",
                config: { headerName: "x-api-key" }
            })
        );

        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers["x-api-key"]).toBe("test-key");
        expect(headers.authorization).toBeUndefined();
        expect(calls[0].url).toBe("http://localhost:8000/v1/decide");
    });

    it("rejects a malformed header name", async () => {
        const error = await providerError(
            decide(
                systemoneAdapter,
                connection("systemone", {
                    baseUrl: "http://localhost:8000",
                    config: { headerName: "bad header" }
                })
            )
        );

        expect(error.code).toBe("validation");
        expect(calls).toHaveLength(0);
    });

    it("requires an endpoint URL", async () => {
        const error = await providerError(decide(systemoneAdapter, connection("systemone")));

        expect(error.code).toBe("validation");
        expect(calls).toHaveLength(0);
    });

    it("validates with /health and keeps known capabilities", async () => {
        respond({ ok: true, model: "laya", capabilities: ["text", "image", "bogus"] });

        const result = await systemoneAdapter.validate(
            connection("systemone", { baseUrl: "http://localhost:8000" })
        );

        expect(calls[0].url).toBe("http://localhost:8000/health");
        expect(result).toEqual({ ok: true, model: "laya", capabilities: ["text", "image"] });
    });

    it("reports a failing or unreachable health check", async () => {
        respond({ ok: false });
        await expect(
            systemoneAdapter.validate(connection("systemone", { baseUrl: "http://localhost:8000" }))
        ).resolves.toEqual({ ok: false, error: "upstream" });

        vi.stubGlobal("fetch", async () => {
            throw new TypeError("fetch failed");
        });
        await expect(
            systemoneAdapter.validate(connection("systemone", { baseUrl: "http://localhost:8000" }))
        ).resolves.toEqual({ ok: false, error: "network" });
    });

    it("reports a missing URL from validate", async () => {
        await expect(systemoneAdapter.validate(connection("systemone"))).resolves.toEqual({
            ok: false,
            error: "validation"
        });
    });
});

describe("adapter registry", () => {
    it("registers every provider exactly once", () => {
        expect(adapterList.map((adapter) => adapter.id)).toEqual([
            "jev",
            "laya",
            "clef",
            "cloudflare",
            "systemone"
        ]);

        expect(getAdapter("laya")).toBe(layaAdapter);
    });

    it("gives every adapter a URL policy and at least one capability", () => {
        for (const adapter of adapterList) {
            expect(typeof adapter.defaultBaseUrl).toBe("string");
            expect(adapter.capabilities.length).toBeGreaterThan(0);
        }

        // Hosted providers ship a default endpoint and known models. A custom
        // endpoint has neither: the user supplies the URL and the model.
        for (const adapter of adapterList) {
            if (adapter.id === "systemone") continue;
            expect(adapter.defaultBaseUrl).not.toBe("");
            expect(adapter.models.length).toBeGreaterThan(0);
        }

        expect(systemoneAdapter.defaultBaseUrl).toBe("");
        expect(systemoneAdapter.models).toEqual([]);
    });
});
