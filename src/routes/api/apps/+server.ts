import { env } from "cloudflare:workers";
import type { RequestHandler } from "./$types";
import {
    assertBodyLimit,
    assertSameOrigin,
    handle,
    json,
    readJson,
    requireUser
} from "#lib/server/api";
import { createApp, listApps } from "#lib/server/apps";
import { getDb } from "#lib/server/db";

/** A create body is one template id. */
const MAX_BODY_BYTES = 4 * 1024;

export const GET: RequestHandler = handle(async ({ locals }) => {
    const user = requireUser(locals);
    const apps = await listApps(getDb(env.DB), user.id);

    return json({ apps });
});

export const POST: RequestHandler = handle(async (event) => {
    const user = requireUser(event.locals);
    assertSameOrigin(event);
    assertBodyLimit(event.request, MAX_BODY_BYTES);

    const app = await createApp({
        db: getDb(env.DB),
        userId: user.id,
        input: await readJson(event.request)
    });

    return json({ app }, 201);
});
