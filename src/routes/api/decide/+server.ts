import { env, waitUntil } from "cloudflare:workers";
import type { RequestHandler } from "./$types";
import {
    ApiError,
    assertBodyLimit,
    assertSameOrigin,
    handle,
    json,
    rateLimited,
    readJson,
    requireUser
} from "#lib/server/api";
import { getKeyRing } from "#lib/server/config";
import { ConnectionError, getConnectionRow, resolveConnection } from "#lib/server/connections";
import { getDb } from "#lib/server/db";
import {
    accountDecideSchema,
    addUsage,
    runDecide,
    subjectFor,
    toClientResult
} from "#lib/server/decide";
import { checkLimits, recordUsage } from "#lib/server/rate-limit";
import { logEvent } from "#lib/server/log";

const MAX_BODY_BYTES = 64 * 1024;

export const POST: RequestHandler = handle(async (event) => {
    const user = requireUser(event.locals);
    assertSameOrigin(event);
    assertBodyLimit(event.request, MAX_BODY_BYTES);

    const parsed = accountDecideSchema.safeParse(await readJson(event.request));
    if (!parsed.success) throw new ApiError(400, "invalid", "Check the request body");
    const { connectionId, ...request } = parsed.data;

    const limit = await checkLimits(env.RATE_LIMITER, [
        subjectFor("user", user.id),
        subjectFor("connection", connectionId)
    ]);
    if (!limit.allowed) return rateLimited(limit.retryAfter);

    const db = getDb(env.DB);
    const row = await getConnectionRow(db, user.id, connectionId);
    if (!row) throw new ConnectionError("not_found", "That connection does not exist");

    const connection = await resolveConnection(row, await getKeyRing());
    const response = await runDecide(connection, request, event.request.signal);

    waitUntil(
        recordUsage(db, subjectFor("user", user.id), addUsage(response.usage)).catch(() =>
            logEvent("warn", "usage_counter_failed")
        )
    );

    return json(toClientResult(response));
});
