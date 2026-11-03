import { env } from "cloudflare:workers";
import type { RequestHandler } from "./$types";
import {
    ApiError,
    assertBodyLimit,
    assertSameOrigin,
    handle,
    json,
    rateLimited,
    readJson
} from "#lib/server/api";
import { endpointPolicy } from "#lib/server/config";
import { guestConnection, hashIp, runDecide, subjectFor, toClientResult } from "#lib/server/decide";
import { decideRequestSchema } from "#lib/decide/types";
import { checkLimits } from "#lib/server/rate-limit";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Guest cloud keys (SPEC §10.5). The key arrives in a header, is used once,
 * and is never written to D1 or a log line. Local endpoints are rejected here
 * on purpose: the browser calls those directly. No row is written for a guest
 * run; only the rate limiter sees a hashed address.
 */
export const POST: RequestHandler = handle(async (event) => {
    assertSameOrigin(event);
    assertBodyLimit(event.request, MAX_BODY_BYTES);

    const parsed = decideRequestSchema.safeParse(await readJson(event.request));
    if (!parsed.success) throw new ApiError(400, "invalid", "Check the request body");

    const ipHash = await hashIp(event.getClientAddress());
    const limit = await checkLimits(env.RATE_LIMITER, [subjectFor("ip", ipHash)]);
    if (!limit.allowed) return rateLimited(limit.retryAfter);

    const connection = guestConnection(event.request.headers, endpointPolicy());
    const response = await runDecide(connection, parsed.data, event.request.signal);

    return json(toClientResult(response));
});
