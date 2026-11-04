import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DecideRequest, Question } from "#lib/decide/types";
import {
    clefAdapter,
    cloudflareAdapter,
    jevAdapter,
    layaAdapter,
    ProviderError,
    systemoneAdapter,
    type DecideAdapter,
    type ResolvedConnection
} from "./index";

/**
 * Contract fixtures: one recorded-shape payload per provider, with the
 * differences adapters must absorb. See `fixtures/README.md`.
 */
const fixture = (provider: string): unknown =>
    JSON.parse(readFileSync(new URL(`./fixtures/${provider}.json`, import.meta.url), "utf8"));

const questions: Record<string, Question> = {
    palette: {
        type: "choice",
        instructions: "Pick a palette.",
        criteria: { dusk: "Muted purples", dawn: "Warm pastels", moss: "Deep greens" }
    },
    energy: {
        type: "score",
        instructions: "How loud is it?",
        criteria: ["calm", "steady", "loud"]
    },
    spark: { type: "noul", instructions: "How much spark?" }
};

const request: DecideRequest = { state: "a moody forest", questions };

const connection = (
    provider: ResolvedConnection["provider"],
    overrides: Partial<ResolvedConnection> = {}
): ResolvedConnection => ({
    provider,
    baseUrl: "",
    config: {},
    secret: "fixture-key",
    ...overrides
});

interface Case {
    name: string;
    adapter: DecideAdapter;
    connection: ResolvedConnection;
    url: string;
    model: string | undefined;
    answers: {
        palette: { choice: string; confidence: number; probabilities: Record<string, number> };
        energy: { score: number; level: number; confidence: number };
        spark: { noul: number };
    };
}

const cases: Case[] = [
    {
        name: "jev",
        adapter: jevAdapter,
        connection: connection("jev"),
        url: "https://jevtypesafe.org/api/v1/decide",
        model: "jev",
        answers: {
            palette: {
                choice: "moss",
                confidence: 0.62,
                probabilities: { dusk: 0.18, dawn: 0.2, moss: 0.62 }
            },
            energy: { score: 0.725, level: 2, confidence: 0.55 },
            spark: { noul: 0.8 }
        }
    },
    {
        name: "laya",
        adapter: layaAdapter,
        connection: connection("laya"),
        url: "https://api.layaaimodel.com/v1/decide",
        model: "convaiinnovations/laya",
        answers: {
            palette: {
                choice: "dusk",
                confidence: 0.42,
                probabilities: { dusk: 0.42, dawn: 0.33, moss: 0.25 }
            },
            energy: { score: 0.5, level: 1, confidence: 0.5 },
            spark: { noul: 1 }
        }
    },
    {
        name: "clef",
        adapter: clefAdapter,
        connection: connection("clef"),
        url: "https://clefdemo.com/v1/clef-omni/run/",
        model: "clef-omni",
        answers: {
            palette: {
                choice: "dawn",
                confidence: 1,
                probabilities: { dusk: 0, dawn: 1, moss: 0 }
            },
            energy: { score: 1, level: 2, confidence: 0 },
            spark: { noul: 0 }
        }
    },
    {
        name: "cloudflare",
        adapter: cloudflareAdapter,
        connection: connection("cloudflare", { config: { accountId: "acct_fixture" } }),
        url: "https://api.cloudflare.com/client/v4/accounts/acct_fixture/ai/run/@cf/cloudflare/clef",
        model: "@cf/cloudflare/clef",
        answers: {
            palette: {
                choice: "moss",
                confidence: 0.9,
                probabilities: { dusk: 0.1, dawn: 0, moss: 0.9 }
            },
            energy: { score: 0, level: 0, confidence: 0 },
            spark: { noul: 0.15 }
        }
    },
    {
        name: "systemone",
        adapter: systemoneAdapter,
        connection: connection("systemone", {
            baseUrl: "http://127.0.0.1:8098",
            secret: ""
        }),
        url: "http://127.0.0.1:8098/v1/decide",
        model: undefined,
        answers: {
            palette: {
                choice: "dawn",
                confidence: 1,
                probabilities: { dusk: 0, dawn: 1, moss: 0 }
            },
            energy: { score: 0.85, level: 2, confidence: 0.7 },
            spark: { noul: 0.5 }
        }
    }
];

const calls: Array<{ url: string; init: RequestInit }> = [];

const respond = (payload: unknown, status = 200): void => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify(payload), {
            status,
            headers: { "content-type": "application/json" }
        });
    });
};

afterEach(() => {
    vi.unstubAllGlobals();
    calls.length = 0;
});

describe("provider contract fixtures", () => {
    for (const testCase of cases) {
        it(`${testCase.name} normalizes its payload to the shared contract`, async () => {
            const payload = fixture(testCase.name);
            respond(payload);

            const result = await testCase.adapter.decide(
                {
                    connection: testCase.connection,
                    signal: new AbortController().signal
                },
                request
            );

            expect(calls).toHaveLength(1);
            expect(calls[0]!.url).toBe(testCase.url);
            expect(calls[0]!.init.method).toBe("POST");

            const body = JSON.parse(String(calls[0]!.init.body)) as DecideRequest;
            expect(body.state).toBe(request.state);
            expect(body.questions).toEqual(questions);
            expect(body.model).toBe(testCase.model);

            const expected = testCase.answers;
            const palette = result.answers.palette;
            expect(palette).toMatchObject({
                type: "choice",
                choice: expected.palette.choice,
                confidence: expected.palette.confidence
            });
            expect(palette?.type === "choice" ? palette.probabilities : undefined).toEqual(
                expected.palette.probabilities
            );

            const energy = result.answers.energy;
            expect(energy).toMatchObject({
                type: "score",
                level: expected.energy.level,
                levels: 3,
                confidence: expected.energy.confidence
            });
            expect(energy?.type === "score" ? energy.score : undefined).toBeCloseTo(
                expected.energy.score,
                6
            );

            expect(result.answers.spark).toEqual({ type: "noul", noul: expected.spark.noul });

            // The fixture's unknown question never reaches the response.
            expect(Object.keys(result.answers).sort()).toEqual(["energy", "palette", "spark"]);
            expect(result._raw).toEqual(payload);
        });
    }

    it("falls back to the adapter model when the payload omits one", async () => {
        respond(fixture("jev"));
        const result = await jevAdapter.decide(
            { connection: connection("jev"), signal: new AbortController().signal },
            request
        );
        expect(result.model).toBe("jev");
    });
});

describe("provider error mapping", () => {
    const statuses = [
        [401, "auth"],
        [402, "quota"],
        [429, "rate_limit"],
        [408, "timeout"],
        [422, "validation"],
        [500, "upstream"]
    ] as const;

    for (const testCase of cases) {
        it(`${testCase.name} maps statuses to stable codes`, async () => {
            for (const [status, code] of statuses) {
                calls.length = 0;
                respond({ error: "provider detail" }, status);

                const failure = testCase.adapter.decide(
                    {
                        connection: testCase.connection,
                        signal: new AbortController().signal
                    },
                    request
                );

                await expect(failure).rejects.toBeInstanceOf(ProviderError);
                await failure.catch((error: ProviderError) => {
                    expect(error.code).toBe(code);
                    expect(error.message).not.toContain("provider detail");
                });
                expect(calls).toHaveLength(1);
            }
        });
    }
});
