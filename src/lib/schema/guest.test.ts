import { describe, expect, it } from "vitest";
import { guestConnectionSchema, makeGuestConnection } from "./guest";

const cloud = {
    mode: "cloud",
    provider: "laya",
    label: "Personal Laya",
    baseUrl: "https://api.laya.example/v1",
    secret: "  sk-live-123  "
};

describe("makeGuestConnection", () => {
    it("builds a cloud row and trims the key and URL", () => {
        const row = makeGuestConnection(cloud, { id: "guest-1", now: 1_700_000_000_000 });

        expect(row).toEqual({
            id: "guest-1",
            version: 1,
            mode: "cloud",
            provider: "laya",
            label: "Personal Laya",
            baseUrl: "https://api.laya.example/v1",
            secret: "sk-live-123",
            createdAt: 1_700_000_000_000
        });
    });

    it("builds a local row for the custom provider", () => {
        const row = makeGuestConnection(
            {
                mode: "local",
                provider: "systemone",
                label: "My bridge",
                baseUrl: "  http://127.0.0.1:8098  ",
                model: "local-laya"
            },
            { id: "guest-2", now: 1 }
        );

        expect(row).toMatchObject({
            mode: "local",
            provider: "systemone",
            baseUrl: "http://127.0.0.1:8098",
            model: "local-laya"
        });
        expect(row?.secret).toBeUndefined();
    });

    it("keeps a Cloudflare account id", () => {
        const row = makeGuestConnection(
            { ...cloud, provider: "cloudflare", accountId: "  acct_123  " },
            { id: "g", now: 1 }
        );
        expect(row?.accountId).toBe("acct_123");
        expect(makeGuestConnection({ ...cloud, accountId: "bad id" })).toBeNull();
    });

    it("keeps an optional custom header", () => {
        const row = makeGuestConnection({ ...cloud, headerName: "x-api-key" }, { id: "g", now: 1 });
        expect(row).toMatchObject({ secret: "sk-live-123", headerName: "x-api-key" });
    });

    it("generates an id and timestamp by default", () => {
        const row = makeGuestConnection(cloud);
        expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(row?.createdAt).toBeGreaterThan(0);
    });

    it("rejects a cloud row without a usable key", () => {
        expect(makeGuestConnection({ ...cloud, secret: "   " })).toBeNull();
        expect(makeGuestConnection({ ...cloud, secret: undefined })).toBeNull();
    });

    it("rejects a local row without a URL", () => {
        expect(
            makeGuestConnection({
                mode: "local",
                provider: "systemone",
                label: "Bridge",
                baseUrl: "  "
            })
        ).toBeNull();
    });

    it("rejects a local row that is not the custom provider", () => {
        expect(
            makeGuestConnection({
                mode: "local",
                provider: "laya",
                label: "Bridge",
                baseUrl: "http://127.0.0.1:8098"
            })
        ).toBeNull();
    });

    it("rejects a custom header without a key", () => {
        expect(
            makeGuestConnection({ ...cloud, secret: undefined, headerName: "x-api-key" })
        ).toBeNull();
    });

    it("rejects unknown fields, bad providers, and bad model ids", () => {
        expect(makeGuestConnection({ ...cloud, extra: true })).toBeNull();
        expect(makeGuestConnection({ ...cloud, provider: "openai" })).toBeNull();
        expect(makeGuestConnection({ ...cloud, mode: "server" })).toBeNull();
        expect(makeGuestConnection({ ...cloud, model: "bad model id" })).toBeNull();
        expect(makeGuestConnection({ ...cloud, headerName: "bad header" })).toBeNull();
    });

    it("rejects empty labels and oversized input", () => {
        expect(makeGuestConnection({ ...cloud, label: "   " })).toBeNull();
        expect(makeGuestConnection({ ...cloud, label: "x".repeat(61) })).toBeNull();
        expect(
            makeGuestConnection({ ...cloud, baseUrl: `https://x/${"a".repeat(300)}` })
        ).toBeNull();
    });
});

describe("guestConnectionSchema", () => {
    it("round-trips a stored row", () => {
        const row = makeGuestConnection(cloud, { id: "guest-1", now: 5 });
        expect(guestConnectionSchema.safeParse(row).success).toBe(true);
    });

    it("rejects a row with a future schema version", () => {
        const row = makeGuestConnection(cloud, { id: "guest-1", now: 5 });
        expect(guestConnectionSchema.safeParse({ ...row, version: 2 }).success).toBe(false);
    });
});
