import { env } from "cloudflare:workers";
import type { RequestHandler } from "./$types";
import { assertSameOrigin, handle, json, readJson, requireUser } from "#lib/server/api";
import { endpointPolicy, getKeyRing } from "#lib/server/config";
import { createConnection, listConnections } from "#lib/server/connections";
import { getDb } from "#lib/server/db";

export const GET: RequestHandler = handle(async ({ locals }) => {
    const user = requireUser(locals);
    const connections = await listConnections(getDb(env.DB), user.id);

    return json({ connections });
});

export const POST: RequestHandler = handle(async (event) => {
    const user = requireUser(event.locals);
    assertSameOrigin(event);

    const connection = await createConnection({
        db: getDb(env.DB),
        ring: await getKeyRing(),
        userId: user.id,
        input: await readJson(event.request),
        policy: endpointPolicy()
    });

    return json({ connection }, 201);
});
