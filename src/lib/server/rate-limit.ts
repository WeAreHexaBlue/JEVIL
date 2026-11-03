/**
 * Rate limiting for model-calling routes (SPEC §12).
 *
 * Cloudflare's rate limiting binding is per key. A request checks every key it
 * owns (user, connection, hashed IP), so one noisy tab cannot drain another
 * user's budget. A missing binding is treated as "no limiter configured"
 * rather than failing closed; production always has one.
 */

import { sql } from "drizzle-orm";
import type { getDb } from "./db";
import { usageDaily } from "./db/schema";

/** The subset of Cloudflare's `RateLimit` binding this module uses. */
export interface RateLimiter {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface LimitResult {
    allowed: boolean;
    /** Seconds to wait before retrying. */
    retryAfter: number;
}

export const RATE_WINDOW_SECONDS = 60;

/** Every key must pass; the first rejection ends the check. */
export const checkLimits = async (
    limiter: RateLimiter | undefined,
    keys: string[]
): Promise<LimitResult> => {
    if (!limiter) return { allowed: true, retryAfter: 0 };

    for (const key of keys) {
        const { success } = await limiter.limit({ key: key.slice(0, 256) });
        if (!success) return { allowed: false, retryAfter: RATE_WINDOW_SECONDS };
    }

    return { allowed: true, retryAfter: 0 };
};

export const dayKey = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

type Database = ReturnType<typeof getDb>;

/**
 * Add one run and its token count to the daily counter. Called through
 * `waitUntil` so analytics never delays a response.
 */
export const recordUsage = async (
    db: Database,
    subject: string,
    tokens: number,
    now: Date = new Date()
): Promise<void> => {
    await db
        .insert(usageDaily)
        .values({ subject: subject.slice(0, 128), day: dayKey(now), runs: 1, tokens })
        .onConflictDoUpdate({
            target: [usageDaily.subject, usageDaily.day],
            set: {
                runs: sql`${usageDaily.runs} + 1`,
                tokens: sql`${usageDaily.tokens} + ${tokens}`
            }
        });
};
