import { describe, expect, it } from "vitest";
import { checkLimits, dayKey, type RateLimiter } from "./rate-limit";

const limiter = (allow: (key: string) => boolean, seen: string[] = []): RateLimiter => ({
    async limit({ key }) {
        seen.push(key);
        return { success: allow(key) };
    }
});

describe("checkLimits", () => {
    it("allows everything when no binding exists", async () => {
        await expect(checkLimits(undefined, ["user:a"])).resolves.toEqual({
            allowed: true,
            retryAfter: 0
        });
    });

    it("checks every key and reports the window on failure", async () => {
        const seen: string[] = [];
        const result = await checkLimits(
            limiter((key) => key !== "user:b", seen),
            ["user:a", "user:b", "connection:c"]
        );

        expect(result).toEqual({ allowed: false, retryAfter: 60 });
        expect(seen).toEqual(["user:a", "user:b"]);
    });

    it("allows when every key passes", async () => {
        const result = await checkLimits(
            limiter(() => true),
            ["ip:abc", "connection:c"]
        );
        expect(result.allowed).toBe(true);
    });

    it("truncates a key to the binding's limit", async () => {
        const seen: string[] = [];
        await checkLimits(
            limiter(() => true, seen),
            ["x".repeat(300)]
        );

        expect(seen[0]).toHaveLength(256);
    });
});

describe("dayKey", () => {
    it("uses UTC dates", () => {
        expect(dayKey(new Date("2026-11-03T23:59:59.999Z"))).toBe("2026-11-03");
        expect(dayKey(new Date("2026-11-04T00:00:00.000Z"))).toBe("2026-11-04");
    });
});
