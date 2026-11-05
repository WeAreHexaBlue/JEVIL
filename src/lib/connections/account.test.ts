import { describe, expect, it } from "vitest";
import { AccountDecideError, decideViaAccount } from "./account";
import type { DecideRequest } from "#lib/decide/types";

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

const failure = async (promise: Promise<unknown>): Promise<AccountDecideError> => {
    try {
        await promise;
    } catch (error) {
        if (error instanceof AccountDecideError) return error;
        throw error;
    }
    throw new Error("expected the request to fail");
};

describe("decideViaAccount", () => {
    it("posts the connection id with the request", async () => {
        const { calls, fetchImpl } = capture(json({ model: "laya", answers }));
        const result = await decideViaAccount("conn_1", request, { fetchImpl });

        expect(result).toEqual({ model: "laya", answers });
        expect(calls).toHaveLength(1);
        expect(calls[0]!.url).toBe("/api/decide");
        expect(calls[0]!.init.method).toBe("POST");
        expect(calls[0]!.init.credentials).toBe("same-origin");
        expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({
            connectionId: "conn_1",
            state: "a moody forest"
        });
    });

    it("refuses an empty connection id without calling fetch", async () => {
        let called = false;
        const fetchImpl = (async () => {
            called = true;
            return json({});
        }) as unknown as typeof fetch;

        const error = await failure(decideViaAccount("", request, { fetchImpl }));

        expect(error.code).toBe("invalid");
        expect(called).toBe(false);
    });

    it("maps an error body code to a coded failure", async () => {
        const error = await failure(
            decideViaAccount("conn_1", request, {
                fetchImpl: capture(json({ error: "rate_limit", message: "Slow down" }, 429))
                    .fetchImpl
            })
        );

        expect(error.code).toBe("rate_limit");
        expect(error.status).toBe(429);
        expect(error.message).toBe("Slow down");
    });

    it("falls back to a status code when the body is opaque", async () => {
        const error = await failure(
            decideViaAccount("conn_1", request, {
                fetchImpl: capture(json({ detail: "nope" }, 502)).fetchImpl
            })
        );

        expect(error.code).toBe("upstream");
        expect(error.status).toBe(502);
        expect(error.message).not.toContain("nope");
    });

    it("rejects a payload that does not match the contract", async () => {
        const error = await failure(
            decideViaAccount("conn_1", request, {
                fetchImpl: capture(json({ model: "laya" })).fetchImpl
            })
        );

        expect(error.code).toBe("malformed");
    });

    it("rejects non-JSON and oversized bodies", async () => {
        const plain = await failure(
            decideViaAccount("conn_1", request, {
                fetchImpl: capture(new Response("not json")).fetchImpl
            })
        );
        expect(plain.code).toBe("malformed");

        const big = await failure(
            decideViaAccount("conn_1", request, {
                fetchImpl: capture(json({ model: "laya", answers, meta: { pad: "x".repeat(64) } }))
                    .fetchImpl,
                maxBytes: 16
            })
        );
        expect(big.code).toBe("too_large");
    });

    it("reports a timeout when the request aborts", async () => {
        const fetchImpl = ((_: unknown, init?: RequestInit) => {
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () => {
                    reject(new DOMException("aborted", "AbortError"));
                });
            });
        }) as unknown as typeof fetch;

        const error = await failure(
            decideViaAccount("conn_1", request, { fetchImpl, timeoutMs: 5 })
        );
        expect(error.code).toBe("timeout");
    });

    it("does not call fetch when the caller already aborted", async () => {
        const controller = new AbortController();
        controller.abort();
        let called = false;
        const fetchImpl = (async () => {
            called = true;
            return json({});
        }) as unknown as typeof fetch;

        const error = await failure(
            decideViaAccount("conn_1", request, { fetchImpl, signal: controller.signal })
        );

        expect(error.code).toBe("timeout");
        expect(called).toBe(false);
    });
});
