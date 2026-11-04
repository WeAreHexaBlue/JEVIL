import { describe, expect, it } from "vitest";
import { decideViaProxy, ProxyDecideError, proxyHeaders } from "./proxy";
import { makeGuestConnection, type GuestConnection } from "#lib/schema/guest";
import type { DecideRequest } from "#lib/decide/types";

const connection = (overrides: Record<string, unknown> = {}): GuestConnection =>
    makeGuestConnection(
        {
            mode: "cloud",
            provider: "laya",
            label: "Laya",
            baseUrl: "https://api.layaaimodel.com",
            secret: "laya_test",
            ...overrides
        },
        { id: "guest-1", now: 1 }
    )!;

const request: DecideRequest = {
    state: "a moody forest",
    questions: {
        mood: { type: "choice", instructions: "Pick.", criteria: { dusk: "Dusk" } }
    }
};

const answers = {
    mood: { type: "choice", choice: "dusk", confidence: 1, probabilities: { dusk: 1 } }
};

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" }
    });

const capture = (response: Response) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return response;
    }) as typeof fetch;
    return { calls, fetchImpl };
};

const failure = async (promise: Promise<unknown>): Promise<ProxyDecideError> => {
    try {
        await promise;
    } catch (error) {
        if (error instanceof ProxyDecideError) return error;
        throw error;
    }
    throw new Error("expected the request to fail");
};

describe("proxyHeaders", () => {
    it("sends the provider, key, and optional fields", () => {
        expect(
            proxyHeaders(
                connection({
                    provider: "cloudflare",
                    model: " @cf/cloudflare/clef ",
                    accountId: "acct_1"
                })
            )
        ).toEqual({
            "content-type": "application/json",
            "x-jevil-provider": "cloudflare",
            "x-jevil-base-url": "https://api.layaaimodel.com",
            "x-jevil-model": "@cf/cloudflare/clef",
            "x-jevil-key": "laya_test",
            "x-jevil-account-id": "acct_1"
        });
    });

    it("omits empty optional headers", () => {
        const headers = proxyHeaders(connection({ baseUrl: "", model: undefined }));
        expect(headers).not.toHaveProperty("x-jevil-base-url");
        expect(headers).not.toHaveProperty("x-jevil-model");
    });

    it("refuses a local connection", () => {
        const local = makeGuestConnection(
            {
                mode: "local",
                provider: "systemone",
                label: "Bridge",
                baseUrl: "http://127.0.0.1:8098"
            },
            { id: "guest-2", now: 1 }
        )!;

        expect(() => proxyHeaders(local)).toThrow(ProxyDecideError);
    });
});

describe("decideViaProxy", () => {
    it("posts the request and returns the contract response", async () => {
        const { calls, fetchImpl } = capture(
            json({ model: "laya", answers, usage: { input_tokens: 3 }, extra: true })
        );

        const result = await decideViaProxy(connection(), request, { fetchImpl });

        expect(calls[0]!.url).toBe("/api/proxy/decide");
        expect(calls[0]!.init.method).toBe("POST");
        expect(calls[0]!.init.redirect).toBe("manual");
        expect(JSON.parse(String(calls[0]!.init.body))).toEqual(request);
        expect(calls[0]!.init.headers).toMatchObject({
            "x-jevil-provider": "laya",
            "x-jevil-key": "laya_test"
        });

        expect(result.model).toBe("laya");
        expect(result.answers.mood).toEqual(answers.mood);
        expect(result.usage).toEqual({ input_tokens: 3 });
        expect(result).not.toHaveProperty("extra");
    });

    it("surfaces the proxy's stable error code and message", async () => {
        const { fetchImpl } = capture(
            json({ error: "rate_limit", message: "Too many requests. Try again shortly." }, 429)
        );

        const error = await failure(decideViaProxy(connection(), request, { fetchImpl }));

        expect(error.code).toBe("rate_limit");
        expect(error.status).toBe(429);
        expect(error.message).toBe("Too many requests. Try again shortly.");
        expect(error.message).not.toContain("laya_test");
    });

    it("falls back to the status when the error body is unknown", async () => {
        const { fetchImpl } = capture(json({ error: "bogus" }, 502));
        const error = await failure(decideViaProxy(connection(), request, { fetchImpl }));

        expect(error.code).toBe("upstream");
        expect(error.message).toBe("The decide proxy returned HTTP 502");
    });

    it("reports a redirect instead of following it", async () => {
        const { fetchImpl } = capture(json({}, 307));
        const error = await failure(decideViaProxy(connection(), request, { fetchImpl }));
        expect(error.code).toBe("upstream");
    });

    it("rejects a malformed success payload", async () => {
        const { fetchImpl } = capture(json({ model: "laya" }));
        const error = await failure(decideViaProxy(connection(), request, { fetchImpl }));
        expect(error.code).toBe("malformed");
    });

    it("rejects an oversized response", async () => {
        const { fetchImpl } = capture(json({ model: "laya", answers }));
        const error = await failure(
            decideViaProxy(connection(), request, { fetchImpl, maxBytes: 8 })
        );
        expect(error.code).toBe("too_large");
    });

    it("reports an unreachable proxy and honors a timeout", async () => {
        const unreachable = await failure(
            decideViaProxy(connection(), request, {
                fetchImpl: (async () => {
                    throw new TypeError("Failed to fetch");
                }) as typeof fetch
            })
        );
        expect(unreachable.code).toBe("unreachable");

        const never = ((_: unknown, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () =>
                    reject(new DOMException("Aborted", "AbortError"))
                );
            })) as typeof fetch;

        const timedOut = await failure(
            decideViaProxy(connection(), request, { fetchImpl: never, timeoutMs: 10 })
        );
        expect(timedOut.code).toBe("timeout");
    });
});
