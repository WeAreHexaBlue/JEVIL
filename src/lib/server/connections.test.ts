import { describe, expect, it } from "vitest";
import { connectionCreateSchema, connectionPatchSchema } from "#lib/schema/connection";
import {
    authSchemeFor,
    normalizeConnectionInput,
    toConnectionView,
    ConnectionError,
    type ConnectionRow
} from "./connections";
import type { EndpointPolicy } from "./ssrf";

const dev: EndpointPolicy = { production: false, allowLocal: true };
const prod: EndpointPolicy = { production: true, allowLocal: false };

const code = (run: () => unknown): string => {
    try {
        run();
    } catch (error) {
        if (error instanceof ConnectionError) return error.code;
        throw error;
    }
    throw new Error("expected a ConnectionError");
};

describe("normalizeConnectionInput", () => {
    it("keeps a hosted provider's defaults when no URL is given", () => {
        expect(normalizeConnectionInput({ provider: "jev" }, prod)).toEqual({
            baseUrl: "",
            model: null,
            config: {}
        });
    });

    it("requires a URL for a custom endpoint", () => {
        expect(code(() => normalizeConnectionInput({ provider: "systemone" }, dev))).toBe(
            "invalid"
        );
    });

    it("requires a Cloudflare account id", () => {
        expect(code(() => normalizeConnectionInput({ provider: "cloudflare" }, prod))).toBe(
            "invalid"
        );
    });

    it("only allows a custom header on a custom endpoint", () => {
        expect(
            code(() =>
                normalizeConnectionInput(
                    { provider: "laya", config: { headerName: "x-key" } },
                    prod
                )
            )
        ).toBe("invalid");
    });

    it("applies endpoint and local-host policy", () => {
        expect(
            code(() =>
                normalizeConnectionInput(
                    { provider: "systemone", baseUrl: "http://localhost:8000" },
                    prod
                )
            )
        ).toBe("invalid");

        expect(
            normalizeConnectionInput(
                { provider: "systemone", baseUrl: "http://localhost:8000" },
                dev
            ).baseUrl
        ).toBe("http://localhost:8000");
    });

    it("normalizes the model and trims the URL", () => {
        const normalized = normalizeConnectionInput(
            {
                provider: "laya",
                baseUrl: "  https://proxy.test  ",
                model: "  convaiinnovations/laya  "
            },
            prod
        );

        expect(normalized.baseUrl).toBe("https://proxy.test");
        expect(normalized.model).toBe("convaiinnovations/laya");
    });
});

describe("authSchemeFor", () => {
    it("is always bearer for hosted providers", () => {
        expect(authSchemeFor("jev", {}, false)).toBe("bearer");
    });

    it("reflects whether a custom endpoint has a credential", () => {
        expect(authSchemeFor("systemone", {}, false)).toBe("none");
        expect(authSchemeFor("systemone", {}, true)).toBe("bearer");
        expect(authSchemeFor("systemone", { headerName: "x-key" }, true)).toBe("header");
    });
});

describe("toConnectionView", () => {
    const row: ConnectionRow = {
        id: "conn_1",
        userId: "user_1",
        provider: "jev",
        label: "Personal Jev",
        baseUrl: "",
        model: "jev",
        configJson: '{"accountId":"acct_1"}',
        authScheme: "bearer",
        secretCt: "ciphertext",
        secretIv: "iv",
        keyVersion: 1,
        secretLast4: "4f2a",
        status: "ok",
        lastCheckedAt: new Date(1_700_000_000_000),
        createdAt: new Date(1_700_000_000_000),
        updatedAt: new Date(1_700_000_001_000)
    };

    it("returns display fields and a masked key, never the ciphertext", () => {
        const view = toConnectionView(row);

        expect(view).toMatchObject({
            id: "conn_1",
            provider: "jev",
            label: "Personal Jev",
            secretLast4: "4f2a",
            status: "ok",
            lastCheckedAt: 1_700_000_000_000
        });

        expect(JSON.stringify(view)).not.toContain("ciphertext");
        expect(JSON.stringify(view)).not.toContain("iv");
        expect("secret" in view).toBe(false);
    });

    it("tolerates a malformed config blob", () => {
        expect(toConnectionView({ ...row, configJson: "not json" }).config).toEqual({});
    });
});

describe("connection schemas", () => {
    it("rejects unknown fields", () => {
        expect(
            connectionCreateSchema.safeParse({
                provider: "jev",
                label: "Jev",
                secret: "key",
                admin: true
            }).success
        ).toBe(false);
    });

    it("allows a partial patch but not an empty one", () => {
        expect(connectionPatchSchema.safeParse({ label: "Renamed" }).success).toBe(true);
        expect(connectionPatchSchema.safeParse({}).success).toBe(false);
    });

    it("rejects model ids with path characters", () => {
        expect(
            connectionCreateSchema.safeParse({
                provider: "laya",
                label: "Laya",
                model: "../../etc/passwd"
            }).success
        ).toBe(false);
    });
});
