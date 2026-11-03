import { describe, expect, it, vi } from "vitest";
import type { Question } from "#lib/decide/types";
import { errorCodeForStatus, fetchJson, normalizeAnswers, ProviderError } from "./base";

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" }
    });

/** Await a request that must fail and return the typed ProviderError. */
const providerError = async (request: Promise<unknown>): Promise<ProviderError> => {
    try {
        await request;
    } catch (error) {
        if (error instanceof ProviderError) return error;
        throw error;
    }
    throw new Error("expected the request to fail");
};

describe("errorCodeForStatus", () => {
    it("maps the statuses the adapters care about", () => {
        expect(errorCodeForStatus(401)).toBe("auth");
        expect(errorCodeForStatus(403)).toBe("auth");
        expect(errorCodeForStatus(402)).toBe("quota");
        expect(errorCodeForStatus(429)).toBe("rate_limit");
        expect(errorCodeForStatus(408)).toBe("timeout");
        expect(errorCodeForStatus(400)).toBe("validation");
        expect(errorCodeForStatus(422)).toBe("validation");
        expect(errorCodeForStatus(500)).toBe("upstream");
        expect(errorCodeForStatus(418)).toBe("upstream");
    });
});

describe("fetchJson", () => {
    it("posts JSON and returns the parsed body", async () => {
        const fetchImpl = vi.fn(async () => json({ answers: {} }));

        const result = await fetchJson("https://provider.test/v1/decide", {
            method: "POST",
            headers: { authorization: "Bearer test" },
            body: { state: "x", questions: {} },
            fetchImpl
        });

        expect(result).toEqual({ answers: {} });
        expect(fetchImpl).toHaveBeenCalledOnce();

        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("https://provider.test/v1/decide");
        expect(init.method).toBe("POST");
        expect(init.redirect).toBe("manual");
        expect(init.body).toBe(JSON.stringify({ state: "x", questions: {} }));
        expect((init.headers as Record<string, string>).authorization).toBe("Bearer test");
        expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    });

    it("omits a body and content type for GET", async () => {
        const fetchImpl = vi.fn(async () => json({ ok: true }));

        await fetchJson("https://provider.test/health", { fetchImpl });

        const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(init.body).toBeUndefined();
        expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
    });

    it("maps HTTP failures to safe codes without reading the body", async () => {
        const fetchImpl = async () =>
            new Response("upstream secret sk_live_abcdef", { status: 500 });

        const error = await providerError(fetchJson("https://provider.test", { fetchImpl }));

        expect(error).toBeInstanceOf(ProviderError);
        expect(error.code).toBe("upstream");
        expect(error.status).toBe(500);
        expect(error.message).not.toContain("secret");
    });

    it("rejects redirects instead of following them", async () => {
        const fetchImpl = async () =>
            new Response(null, { status: 302, headers: { location: "https://evil.test" } });

        const error = await providerError(fetchJson("https://provider.test", { fetchImpl }));

        expect(error).toBeInstanceOf(ProviderError);
        expect(error.code).toBe("upstream");
        expect(error.message).toContain("redirect");
    });

    it("times out a hanging request", async () => {
        const fetchImpl: typeof fetch = (_url, init) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
            });

        const error = await providerError(
            fetchJson("https://provider.test", { fetchImpl, timeoutMs: 10 })
        );

        expect(error).toBeInstanceOf(ProviderError);
        expect(error.code).toBe("timeout");
    });

    it("reports a network failure as a network error", async () => {
        const fetchImpl = async () => {
            throw new TypeError("fetch failed");
        };

        const error = await providerError(fetchJson("https://provider.test", { fetchImpl }));

        expect(error).toBeInstanceOf(ProviderError);
        expect(error.code).toBe("network");
    });

    it("rejects invalid JSON and empty responses", async () => {
        const invalid = await providerError(
            fetchJson("https://provider.test", { fetchImpl: async () => new Response("not json") })
        );

        expect(invalid).toBeInstanceOf(ProviderError);
        expect(invalid.message).toContain("invalid JSON");

        const empty = await providerError(
            fetchJson("https://provider.test", { fetchImpl: async () => new Response("") })
        );

        expect(empty).toBeInstanceOf(ProviderError);
        expect(empty.message).toContain("empty");
    });

    it("caps the response size", async () => {
        const fetchImpl = async () => new Response("x".repeat(100));

        const error = await providerError(
            fetchJson("https://provider.test", { fetchImpl, maxBytes: 10 })
        );

        expect(error).toBeInstanceOf(ProviderError);
        expect(error.message).toContain("too large");
    });

    it("does not start when the caller already cancelled", async () => {
        const fetchImpl = vi.fn(async () => json({ ok: true }));

        const error = await providerError(
            fetchJson("https://provider.test", { fetchImpl, signal: AbortSignal.abort() })
        );

        expect(error).toBeInstanceOf(ProviderError);
        expect(error.code).toBe("timeout");
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

const questions: Record<string, Question> = {
    palette: {
        type: "choice",
        instructions: "Pick a palette.",
        criteria: { dusk: "Muted purples", dawn: "Warm pastels" }
    },
    volume: {
        type: "score",
        instructions: "How loud?",
        criteria: ["Whisper", "Talk", "Shout", "Scream"]
    },
    certainty: { type: "noul", instructions: "How sure?" }
};

const noop = () => {};

describe("normalizeAnswers", () => {
    it("normalizes a choice and fills missing options with zero", () => {
        const { answers, dropped } = normalizeAnswers(
            { palette: { choice: "dusk", probabilities: { dusk: 2, dawn: 2 } } },
            questions,
            { onDrop: noop }
        );

        expect(dropped).toEqual(["volume", "certainty"]);
        expect(answers.palette).toEqual({
            type: "choice",
            choice: "dusk",
            confidence: 0.5,
            probabilities: { dusk: 0.5, dawn: 0.5 }
        });
    });

    it("keeps a provided confidence and clamps it", () => {
        const { answers } = normalizeAnswers(
            { palette: { choice: "dawn", confidence: 1.4, probabilities: { dawn: 3 } } },
            { palette: questions.palette },
            { onDrop: noop }
        );

        expect(answers.palette).toMatchObject({ choice: "dawn", confidence: 1 });
        expect(
            (answers.palette as { probabilities: Record<string, number> }).probabilities
        ).toEqual({
            dusk: 0,
            dawn: 1
        });
    });

    it("derives a score from probabilities keyed by label or index", () => {
        const { answers } = normalizeAnswers(
            {
                volume: {
                    probabilities: { "0": 0.05, Talk: 0.1, "2": 0.7, "3": 0.15 },
                    confidence: 0.9
                }
            },
            { volume: questions.volume },
            { onDrop: noop }
        );

        expect(answers.volume).toMatchObject({
            type: "score",
            confidence: 0.9,
            level: 2,
            levels: 4
        });
        expect((answers.volume as { score: number }).score).toBeCloseTo(0.65, 10);
        expect((answers.volume as { probabilities: Record<string, number> }).probabilities).toEqual(
            {
                "0": 0.05,
                "1": 0.1,
                "2": 0.7,
                "3": 0.15
            }
        );
    });

    it("falls back to a raw level when there is no distribution", () => {
        const { answers } = normalizeAnswers(
            { volume: { score: 2 } },
            {
                volume: {
                    type: "score",
                    instructions: "How loud?",
                    criteria: ["Low", "Mid", "High"]
                }
            },
            { onDrop: noop }
        );

        expect(answers.volume).toMatchObject({
            type: "score",
            score: 1,
            confidence: 0,
            level: 2,
            levels: 3
        });
        expect((answers.volume as { probabilities: Record<string, number> }).probabilities).toEqual(
            {
                "0": 0,
                "1": 0,
                "2": 0
            }
        );
    });

    it("clamps a raw level into the level range", () => {
        const { answers } = normalizeAnswers(
            { volume: { level: 99 } },
            { volume: { type: "score", instructions: "How loud?", criteria: ["Low", "High"] } },
            { onDrop: noop }
        );

        expect(answers.volume).toMatchObject({ level: 1, score: 1, levels: 2 });
    });

    it("accepts noul under either name and clamps it", () => {
        const first = normalizeAnswers(
            { certainty: { noul: 1.3 } },
            { certainty: questions.certainty },
            { onDrop: noop }
        );
        expect(first.answers.certainty).toEqual({ type: "noul", noul: 1 });

        const second = normalizeAnswers(
            { certainty: { probability: -0.2 } },
            { certainty: questions.certainty },
            { onDrop: noop }
        );
        expect(second.answers.certainty).toEqual({ type: "noul", noul: 0 });
    });

    it("drops unknown choices, empty answers, and non-object payloads", () => {
        const dropped: string[] = [];
        const { answers } = normalizeAnswers(
            {
                palette: { choice: "neon" },
                volume: { level: 1 },
                certainty: null
            },
            questions,
            { onDrop: (id) => dropped.push(id) }
        );

        expect(answers).toHaveProperty("volume");
        expect(answers).not.toHaveProperty("palette");
        expect(answers).not.toHaveProperty("certainty");
        expect(dropped).toEqual(["palette", "certainty"]);
    });

    it("drops every question when the payload is not an object", () => {
        const dropped: string[] = [];
        const { answers } = normalizeAnswers("not an answer map", questions, {
            onDrop: (id) => dropped.push(id)
        });

        expect(answers).toEqual({});
        expect(dropped).toEqual(["palette", "volume", "certainty"]);
    });
});
