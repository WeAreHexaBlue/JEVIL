import { describe, expect, it } from "vitest";
import type { DecideRequest } from "#lib/decide/types";
import { ConnectionError } from "./connections";
import {
    accountDecideSchema,
    addUsage,
    guestConnection,
    hashIp,
    statusForProviderError,
    subjectFor,
    toClientResult
} from "./decide";
import type { EndpointPolicy } from "./ssrf";

const dev: EndpointPolicy = { production: false, allowLocal: true };
const prod: EndpointPolicy = { production: true, allowLocal: false };

const request: DecideRequest = {
    state: "a moody forest",
    questions: {
        palette: { type: "noul", instructions: "How moody is it?" }
    }
};

const headers = (values: Record<string, string>): Headers => new Headers(values);

describe("accountDecideSchema", () => {
    it("accepts a decide request plus a connection id", () => {
        expect(accountDecideSchema.safeParse({ ...request, connectionId: "conn_1" }).success).toBe(
            true
        );
    });

    it("rejects a missing connection id and unknown fields", () => {
        expect(accountDecideSchema.safeParse(request).success).toBe(false);
        expect(
            accountDecideSchema.safeParse({ ...request, connectionId: "c", raw: true }).success
        ).toBe(false);
    });
});

describe("toClientResult", () => {
    it("drops the raw provider payload but keeps usage and meta", () => {
        const result = toClientResult({
            model: "jev",
            answers: {
                palette: { type: "noul", noul: 0.5 }
            },
            usage: { input_tokens: 3, output_tokens: 1 },
            meta: { requestId: "r1" },
            _raw: { secret: "provider-payload" }
        });

        expect(JSON.stringify(result)).not.toContain("provider-payload");
        expect(result.usage).toEqual({ input_tokens: 3, output_tokens: 1 });
        expect(result.meta).toEqual({ requestId: "r1" });
    });
});

describe("addUsage", () => {
    it("prefers billed tokens, then sums input and output", () => {
        expect(addUsage({ billed_tokens: 9, input_tokens: 3, output_tokens: 1 })).toBe(9);
        expect(addUsage({ input_tokens: 3, output_tokens: 1 })).toBe(4);
        expect(addUsage(undefined)).toBe(0);
    });
});

describe("statusForProviderError", () => {
    it("maps provider codes to stable statuses", () => {
        expect(statusForProviderError("auth")).toBe(401);
        expect(statusForProviderError("rate_limit")).toBe(429);
        expect(statusForProviderError("quota")).toBe(402);
        expect(statusForProviderError("validation")).toBe(400);
        expect(statusForProviderError("unsupported")).toBe(400);
        expect(statusForProviderError("timeout")).toBe(504);
        expect(statusForProviderError("network")).toBe(502);
        expect(statusForProviderError("upstream")).toBe(502);
    });
});

describe("guestConnection", () => {
    it("builds a hosted connection from headers", () => {
        const connection = guestConnection(
            headers({
                "x-jevil-provider": "laya",
                "x-jevil-model": " convaiinnovations/laya ",
                "x-jevil-key": "laya_test"
            }),
            dev
        );

        expect(connection).toMatchObject({
            provider: "laya",
            baseUrl: "",
            model: "convaiinnovations/laya",
            secret: "laya_test"
        });
    });

    it("requires a known provider and a credential", () => {
        expect(() => guestConnection(headers({ "x-jevil-key": "k" }), dev)).toThrow(
            ConnectionError
        );
        expect(() => guestConnection(headers({ "x-jevil-provider": "jev" }), dev)).toThrow(
            ConnectionError
        );
        expect(() =>
            guestConnection(headers({ "x-jevil-provider": "bogus", "x-jevil-key": "k" }), dev)
        ).toThrow(ConnectionError);
    });

    it("never accepts a local or custom endpoint", () => {
        expect(() =>
            guestConnection(
                headers({
                    "x-jevil-provider": "systemone",
                    "x-jevil-base-url": "http://localhost:8000",
                    "x-jevil-key": "k"
                }),
                dev
            )
        ).toThrow(ConnectionError);

        expect(() =>
            guestConnection(
                headers({
                    "x-jevil-provider": "jev",
                    "x-jevil-base-url": "http://localhost:8000",
                    "x-jevil-key": "k"
                }),
                dev
            )
        ).toThrow(ConnectionError);
    });

    it("validates a remote override URL", () => {
        expect(() =>
            guestConnection(
                headers({
                    "x-jevil-provider": "laya",
                    "x-jevil-base-url": "http://api.layaaimodel.com",
                    "x-jevil-key": "k"
                }),
                dev
            )
        ).toThrow(ConnectionError);

        expect(() =>
            guestConnection(
                headers({
                    "x-jevil-provider": "laya",
                    "x-jevil-base-url": "https://proxy.test",
                    "x-jevil-key": "k"
                }),
                prod
            )
        ).not.toThrow();
    });
});

describe("subjects", () => {
    it("namespaces keys so a user and an IP never collide", () => {
        expect(subjectFor("user", "abc")).toBe("user:abc");
        expect(subjectFor("ip", "abc")).toBe("ip:abc");
    });

    it("hashes an IP to a short, stable subject", async () => {
        const first = await hashIp("203.0.113.7");
        const second = await hashIp("203.0.113.7");

        expect(first).toBe(second);
        expect(first).toMatch(/^[0-9a-f]{16}$/);
        expect(first).not.toContain("203.0.113.7");
        expect(await hashIp("203.0.113.8")).not.toBe(first);
    });
});
