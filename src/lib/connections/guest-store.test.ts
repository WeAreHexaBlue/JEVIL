import { describe, expect, it } from "vitest";
import {
    clearGuestConnections,
    deleteGuestConnection,
    GUEST_STORAGE_UNAVAILABLE,
    isGuestStoreAvailable,
    listGuestConnections,
    saveGuestConnection,
    validGuestConnections
} from "./guest-store";
import { makeGuestConnection } from "#lib/schema/guest";

const row = (id: string, createdAt: number) =>
    makeGuestConnection(
        {
            mode: "cloud",
            provider: "laya",
            label: id,
            baseUrl: "https://api.laya.example",
            secret: "sk-test"
        },
        { id, now: createdAt }
    )!;

describe("validGuestConnections", () => {
    it("keeps valid rows newest first and never throws on bad ones", () => {
        const rows = [
            row("old", 1),
            row("new", 3),
            { id: "broken" },
            null,
            "nope",
            { ...row("future", 2), version: 2 }
        ];

        expect(validGuestConnections(rows).map((connection) => connection.id)).toEqual([
            "new",
            "old"
        ]);
    });

    it("returns an empty list for empty storage", () => {
        expect(validGuestConnections([])).toEqual([]);
    });
});

describe("guest storage without IndexedDB", () => {
    it("reports availability and degrades to an empty list", async () => {
        expect(isGuestStoreAvailable()).toBe(false);
        await expect(listGuestConnections()).resolves.toEqual([]);
        await expect(clearGuestConnections()).resolves.toBeUndefined();
    });

    it("refuses to write or delete instead of throwing a ReferenceError", async () => {
        await expect(saveGuestConnection(row("one", 1))).rejects.toThrow(GUEST_STORAGE_UNAVAILABLE);
        await expect(deleteGuestConnection("one")).rejects.toThrow(GUEST_STORAGE_UNAVAILABLE);
    });
});
