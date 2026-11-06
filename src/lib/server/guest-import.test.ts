import { describe, expect, it } from "vitest";
import {
    guestConnectionInput,
    IMPORT_MAX_BYTES,
    IMPORT_MAX_ENTRIES,
    parseGuestImport
} from "./guest-import";
import { makeGuestConnection, type GuestConnection } from "#lib/schema/guest";

const cloud = (overrides: Record<string, unknown> = {}): GuestConnection =>
    makeGuestConnection(
        {
            mode: "cloud",
            provider: "laya",
            label: "Personal Laya",
            baseUrl: "https://laya-model.com",
            secret: "laya_test",
            ...overrides
        },
        { id: "guest-1", now: 1 }
    )!;

const local = (): GuestConnection =>
    makeGuestConnection(
        {
            mode: "local",
            provider: "systemone",
            label: "Bridge",
            baseUrl: "http://127.0.0.1:8098"
        },
        { id: "guest-2", now: 2 }
    )!;

describe("parseGuestImport", () => {
    it("keeps cloud rows and skips local ones", () => {
        const result = parseGuestImport(JSON.stringify([cloud(), local()]));

        expect(result?.connections.map((connection) => connection.id)).toEqual(["guest-1"]);
        expect(result?.skipped).toBe(1);
    });

    it("skips invalid rows without failing the batch", () => {
        const result = parseGuestImport(JSON.stringify([{ id: "broken" }, cloud()]));

        expect(result?.connections).toHaveLength(1);
        expect(result?.skipped).toBe(1);
    });

    it("returns null when nothing is importable", () => {
        expect(parseGuestImport("[]")).toBeNull();
        expect(parseGuestImport(JSON.stringify([local()]))).toBeNull();
        expect(parseGuestImport(JSON.stringify([{ id: "broken" }]))).toBeNull();
        expect(parseGuestImport("")).toBeNull();
    });

    it("rejects malformed input and oversized batches", () => {
        expect(parseGuestImport("not json")).toBeNull();
        expect(parseGuestImport(JSON.stringify({ connections: [] }))).toBeNull();

        const tooMany = Array.from({ length: IMPORT_MAX_ENTRIES + 1 }, (_, index) =>
            cloud({ label: `Laya ${index}` })
        );
        expect(parseGuestImport(JSON.stringify(tooMany))).toBeNull();

        const huge = `${JSON.stringify([cloud()])}${" ".repeat(IMPORT_MAX_BYTES)}`;
        expect(parseGuestImport(huge)).toBeNull();
    });
});

describe("guestConnectionInput", () => {
    it("maps the guest row to the account input", () => {
        const input = guestConnectionInput(
            cloud({
                provider: "cloudflare",
                model: "@cf/cloudflare/clef",
                accountId: "acct_123"
            })
        );

        expect(input).toEqual({
            provider: "cloudflare",
            label: "Personal Laya",
            baseUrl: "https://laya-model.com",
            model: "@cf/cloudflare/clef",
            secret: "laya_test",
            config: { accountId: "acct_123" }
        });
    });

    it("keeps a custom header and omits empty config", () => {
        expect(guestConnectionInput(cloud({ headerName: "x-api-key" })).config).toEqual({
            headerName: "x-api-key"
        });
        expect(guestConnectionInput(cloud()).config).toEqual({});
    });
});
