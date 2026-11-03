import { describe, expect, it } from "vitest";
import { REDACTED, redact, redactHeaders, safeError } from "./redact";

describe("redact", () => {
    it("drops credentials, headers, and user content by field name", () => {
        const line = redact({
            requestId: "req_1",
            authorization: "Bearer jv_live_secret123",
            cookie: "better-auth.session_token=abc",
            "x-jevil-key": "sk_live_abcdef123456",
            password: "correct-horse-battery",
            email: "flamey@example.com",
            body: { answers: [0.9, 0.1] }
        }) as Record<string, unknown>;

        expect(line.requestId).toBe("req_1");
        expect(line.authorization).toBe(REDACTED);
        expect(line.cookie).toBe(REDACTED);
        expect(line["x-jevil-key"]).toBe(REDACTED);
        expect(line.password).toBe(REDACTED);
        expect(line.email).toBe(REDACTED);
        expect(line.body).toBe(REDACTED);
    });

    it("keeps safe operational fields, including nested ones", () => {
        const line = redact({
            route: "/apps/[slug]",
            status: 404,
            provider: "laya",
            errorCode: "PROVIDER_TIMEOUT",
            nested: { attempt: 2, key: "should-go" }
        }) as Record<string, unknown>;

        expect(line).toMatchObject({
            route: "/apps/[slug]",
            status: 404,
            provider: "laya",
            errorCode: "PROVIDER_TIMEOUT"
        });
        expect((line.nested as Record<string, unknown>).attempt).toBe(2);
        expect((line.nested as Record<string, unknown>).key).toBe(REDACTED);
    });

    it("scrubs token-shaped strings that survive in safe fields", () => {
        const value = redact({
            note: "upstream said sk_live_abcdef123456 and Bearer abcdefghijklmnop"
        }) as Record<string, string>;

        expect(value.note).not.toContain("sk_live_abcdef123456");
        expect(value.note).not.toContain("abcdefghijklmnop");
        expect(value.note).toContain(REDACTED);
    });

    it("truncates long strings and caps depth", () => {
        const deep = { a: { b: { c: { d: { e: { f: { g: "too deep" } } } } } } };

        const value = redact({ text: "x".repeat(1000), deep }) as Record<string, unknown>;
        expect((value.text as string).length).toBeLessThanOrEqual(301);
        expect(JSON.stringify(value.deep)).toContain("[truncated]");
    });

    it("handles null, arrays, errors, and exotic values", () => {
        const line = redact({
            empty: null,
            list: [1, "two", { token: "nope" }],
            error: new Error("boom"),
            big: 10n,
            fn: () => {}
        }) as Record<string, unknown>;

        expect(line.empty).toBeNull();
        expect((line.list as unknown[])[0]).toBe(1);
        expect(((line.list as Record<string, unknown>[])[2] ?? {}).token).toBe(REDACTED);
        expect(line.error).toMatchObject({ name: "Error", message: "boom" });
        expect(line.big).toBe("10");
        expect(line.fn).toBe("[function]");
    });
});

describe("redactHeaders", () => {
    it("keeps safe headers and hides the rest", () => {
        const headers = redactHeaders(
            new Headers({
                "content-type": "application/json",
                authorization: "Bearer jv_live_secret123",
                cookie: "session=abc"
            })
        );

        expect(headers["content-type"]).toBe("application/json");
        expect(headers.authorization).toBe(REDACTED);
        expect(headers.cookie).toBe(REDACTED);
    });

    it("accepts plain objects", () => {
        expect(redactHeaders({ "user-agent": "curl/8", "x-jevil-key": "abc" })).toEqual({
            "user-agent": "curl/8",
            "x-jevil-key": REDACTED
        });
    });
});

describe("safeError", () => {
    it("keeps the name and scrubs the message", () => {
        const result = safeError(new Error("failed with jv_live_abcdef123456"));

        expect(result.errorName).toBe("Error");
        expect(result.errorMessage).not.toContain("jv_live_abcdef123456");
        expect(result.errorMessage).toContain(REDACTED);
    });

    it("falls back for values that are not errors", () => {
        expect(safeError("boom")).toEqual({ errorName: "Error", errorMessage: "Unknown error" });
        expect(safeError({ code: "PROVIDER_TIMEOUT" })).toEqual({
            errorName: "Error",
            errorMessage: "PROVIDER_TIMEOUT"
        });
    });
});
