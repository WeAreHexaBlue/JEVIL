import { describe, expect, it } from "vitest";
import {
    decideLocal,
    isLocalEndpoint,
    LOCAL_MAX_BYTES,
    LocalDecideError,
    type LocalConnection
} from "./local";
import type { DecideRequest } from "#lib/decide/types";

const request: DecideRequest = {
    state: "a moody forest",
    questions: {
        mood: {
            type: "choice",
            instructions: "Palette?",
            criteria: { dusk: "Dusk", dawn: "Dawn" }
        },
        energy: {
            type: "score",
            instructions: "Intensity?",
            criteria: ["calm", "steady", "loud"]
        },
        spark: { type: "noul", instructions: "Spark?" }
    }
};

const connection: LocalConnection = { baseUrl: "http://127.0.0.1:8098" };

const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" }
    });

const answers = {
    mood: { choice: "dusk", confidence: 0.7, probabilities: { dusk: 1, dawn: 0 } },
    energy: {
        level: 1,
        confidence: 0.6,
        probabilities: { calm: 0.2, steady: 0.6, loud: 0.2 }
    },
    spark: { noul: 0.5 }
};

/** Capture the call while still answering it. */
const capture = (body: unknown, status = 200) => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return json(body, status);
    }) as typeof fetch;
    return { calls, fetchImpl };
};

const failure = async (promise: Promise<unknown>): Promise<LocalDecideError> => {
    try {
        await promise;
    } catch (error) {
        if (error instanceof LocalDecideError) return error;
        throw error;
    }
    throw new Error("expected the request to fail");
};

describe("isLocalEndpoint", () => {
    it("recognizes loopback names and rejects everything else", () => {
        expect(isLocalEndpoint("http://localhost:8098")).toBe(true);
        expect(isLocalEndpoint("http://127.0.0.1:8098/v1")).toBe(true);
        expect(isLocalEndpoint("http://[::1]:8098")).toBe(true);
        expect(isLocalEndpoint("  http://LOCALHOST:8098  ")).toBe(true);
        expect(isLocalEndpoint("https://api.laya.example")).toBe(false);
        expect(isLocalEndpoint("http://192.168.1.10:8098")).toBe(false);
        expect(isLocalEndpoint("http://localhost.evil.example")).toBe(false);
        expect(isLocalEndpoint("not a url")).toBe(false);
    });
});

describe("decideLocal", () => {
    it("posts to /v1/decide and returns normalized answers", async () => {
        const { calls, fetchImpl } = capture({
            model: "english",
            answers,
            usage: { input_tokens: 4, output_tokens: 2 },
            meta: { latency_ms: 12 }
        });

        const result = await decideLocal(connection, request, { fetchImpl });

        expect(calls).toHaveLength(1);
        expect(calls[0]!.url).toBe("http://127.0.0.1:8098/v1/decide");
        expect(calls[0]!.init.method).toBe("POST");
        expect(calls[0]!.init.redirect).toBe("manual");
        expect(JSON.parse(String(calls[0]!.init.body))).toEqual(request);

        expect(result.model).toBe("english");
        expect(result.usage).toEqual({ input_tokens: 4, output_tokens: 2 });
        expect(result.meta).toEqual({ latency_ms: 12 });

        const mood = result.answers.mood;
        expect(mood).toMatchObject({ type: "choice", choice: "dusk" });
        const energy = result.answers.energy;
        expect(energy).toMatchObject({ type: "score", level: 1, levels: 3 });
        expect(energy?.type === "score" ? energy.score : undefined).toBeCloseTo(0.5);
        expect(result.answers.spark).toEqual({ type: "noul", noul: 0.5 });
    });

    it("joins a trailing slash and adds the model when one is set", async () => {
        const { calls, fetchImpl } = capture({ answers });
        const result = await decideLocal(
            { ...connection, baseUrl: "http://127.0.0.1:8098///", model: "local-laya" },
            request,
            { fetchImpl }
        );

        expect(calls[0]!.url).toBe("http://127.0.0.1:8098/v1/decide");
        expect(JSON.parse(String(calls[0]!.init.body))).toMatchObject({ model: "local-laya" });
        expect(result.model).toBe("local-laya");
    });

    it("sends a bearer token by default and a custom header when asked", async () => {
        const bearer = capture({ answers });
        await decideLocal({ ...connection, secret: "sk-local" }, request, {
            fetchImpl: bearer.fetchImpl
        });
        expect(bearer.calls[0]!.init.headers).toMatchObject({
            authorization: "Bearer sk-local"
        });

        const custom = capture({ answers });
        await decideLocal({ ...connection, secret: "sk-local", headerName: "x-api-key" }, request, {
            fetchImpl: custom.fetchImpl
        });
        expect(custom.calls[0]!.init.headers).toMatchObject({ "x-api-key": "sk-local" });
        expect(custom.calls[0]!.init.headers).not.toHaveProperty("authorization");
    });

    it("sends no auth header without a secret", async () => {
        const { calls, fetchImpl } = capture({ answers });
        await decideLocal(connection, request, { fetchImpl });
        expect(calls[0]!.init.headers).not.toHaveProperty("authorization");
    });

    it("drops unusable answers without failing the run", async () => {
        const { fetchImpl } = capture({
            answers: {
                mood: { choice: "not-an-option" },
                energy: { level: 1, probabilities: { calm: 0, steady: 1, loud: 0 } }
            }
        });

        const result = await decideLocal(connection, request, { fetchImpl });

        expect(Object.keys(result.answers)).toEqual(["energy"]);
    });

    it("maps provider statuses to stable codes", async () => {
        const cases = [
            [401, "auth"],
            [403, "auth"],
            [402, "quota"],
            [429, "rate_limit"],
            [408, "timeout"],
            [400, "validation"],
            [422, "validation"],
            [500, "upstream"],
            [302, "upstream"]
        ] as const;

        for (const [status, code] of cases) {
            const { fetchImpl } = capture({}, status);
            const error = await failure(decideLocal(connection, request, { fetchImpl }));
            expect(error.code).toBe(code);
            expect(error.status).toBe(status);
            expect(error.message).not.toContain("sk-local");
        }
    });

    it("reports a stopped server or CORS rejection as unreachable", async () => {
        const fetchImpl = (async () => {
            throw new TypeError("Failed to fetch");
        }) as typeof fetch;

        const error = await failure(decideLocal(connection, request, { fetchImpl }));
        expect(error.code).toBe("unreachable");
    });

    it("times out a request that never answers", async () => {
        const fetchImpl = ((_: unknown, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () =>
                    reject(new DOMException("Aborted", "AbortError"))
                );
            })) as typeof fetch;

        const error = await failure(decideLocal(connection, request, { fetchImpl, timeoutMs: 10 }));
        expect(error.code).toBe("timeout");
    });

    it("does not start a request when the caller already cancelled", async () => {
        const controller = new AbortController();
        controller.abort();

        let called = false;
        const fetchImpl = (async () => {
            called = true;
            return json({ answers });
        }) as typeof fetch;

        const error = await failure(
            decideLocal(connection, request, { fetchImpl, signal: controller.signal })
        );
        expect(error.code).toBe("timeout");
        expect(called).toBe(false);
    });

    it("rejects a redirect instead of following it", async () => {
        const error = await failure(
            decideLocal(connection, request, {
                fetchImpl: (async () => json({}, 307)) as typeof fetch
            })
        );
        expect(error.code).toBe("upstream");
    });

    it("rejects an invalid custom header name", async () => {
        const error = await failure(
            decideLocal({ ...connection, secret: "sk-local", headerName: "bad header" }, request, {
                fetchImpl: (async () => json({ answers })) as typeof fetch
            })
        );
        expect(error.code).toBe("validation");
        expect(error.message).not.toContain("sk-local");
    });

    it("rejects a connection with no URL", async () => {
        const error = await failure(
            decideLocal({ baseUrl: "   " }, request, {
                fetchImpl: (async () => json({ answers })) as typeof fetch
            })
        );
        expect(error.code).toBe("validation");
    });

    it("rejects a body over the size limit, declared or actual", async () => {
        const declared = {
            ok: true,
            status: 200,
            headers: new Headers({ "content-length": String(LOCAL_MAX_BYTES + 1) }),
            text: async () => JSON.stringify({ answers })
        } as unknown as Response;
        const declaredError = await failure(
            decideLocal(connection, request, { fetchImpl: (async () => declared) as typeof fetch })
        );
        expect(declaredError.code).toBe("too_large");

        const actualError = await failure(
            decideLocal(connection, request, {
                fetchImpl: (async () => json({ answers })) as typeof fetch,
                maxBytes: 8
            })
        );
        expect(actualError.code).toBe("too_large");
    });

    it("rejects a response that is not JSON or has no answers", async () => {
        const notJson = await failure(
            decideLocal(connection, request, {
                fetchImpl: (async () =>
                    new Response("not json", {
                        headers: { "content-type": "application/json" }
                    })) as typeof fetch
            })
        );
        expect(notJson.code).toBe("malformed");

        const noAnswers = await failure(
            decideLocal(connection, request, {
                fetchImpl: (async () => json({ model: "local" })) as typeof fetch
            })
        );
        expect(noAnswers.code).toBe("malformed");
    });

    it("does not leak the response body in an error", async () => {
        const error = await failure(
            decideLocal(connection, request, {
                fetchImpl: (async () =>
                    new Response(JSON.stringify({ secret: "provider-detail" }), {
                        status: 500
                    })) as typeof fetch
            })
        );
        expect(error.message).toBe("The local endpoint returned HTTP 500");
        expect(JSON.stringify(error)).not.toContain("provider-detail");
    });
});
