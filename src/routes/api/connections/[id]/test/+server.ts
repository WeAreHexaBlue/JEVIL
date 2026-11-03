import { env } from "cloudflare:workers";
import type { RequestHandler } from "./$types";
import { ApiError, assertSameOrigin, handle, json, requireUser } from "#lib/server/api";
import { endpointPolicy, getKeyRing } from "#lib/server/config";
import { testConnection } from "#lib/server/connections";
import { getDb } from "#lib/server/db";

export const POST: RequestHandler = handle(async (event) => {
    const user = requireUser(event.locals);
    assertSameOrigin(event);
    // A test is a write: it records status and last checked.
    const id = event.params.id;
    if (!id) throw new ApiError(400, "invalid", "Missing connection id");

    const { connection, ...result } = await testConnection({
        db: getDb(env.DB),
        ring: await getKeyRing(),
        userId: user.id,
        id,
        policy: endpointPolicy()
    });

    return json({ result, connection });
});
