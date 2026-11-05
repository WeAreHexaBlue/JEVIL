import { env } from "cloudflare:workers";
import type { RequestHandler } from "./$types";
import {
    ApiError,
    assertBodyLimit,
    assertSameOrigin,
    handle,
    json,
    readJson,
    requireUser
} from "#lib/server/api";
import { getApp, updateApp } from "#lib/server/apps";
import { getDb } from "#lib/server/db";
import { MAX_BLUEPRINT_BYTES } from "#lib/schema/app";

/** The blueprint plus the small PATCH envelope around it. */
const MAX_BODY_BYTES = MAX_BLUEPRINT_BYTES + 8 * 1024;

const idParam = (params: Record<string, string>): string => {
    const id = params.id;
    if (!id) throw new ApiError(400, "invalid", "Missing app id");
    return id;
};

export const GET: RequestHandler = handle(async ({ locals, params }) => {
    const user = requireUser(locals);
    const app = await getApp(getDb(env.DB), user.id, idParam(params));

    return json({ app });
});

export const PATCH: RequestHandler = handle(async (event) => {
    const user = requireUser(event.locals);
    assertSameOrigin(event);
    assertBodyLimit(event.request, MAX_BODY_BYTES);

    const app = await updateApp({
        db: getDb(env.DB),
        userId: user.id,
        id: idParam(event.params),
        input: await readJson(event.request)
    });

    return json({ app });
});
