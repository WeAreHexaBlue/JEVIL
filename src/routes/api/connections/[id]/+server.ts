import { env } from "cloudflare:workers";
import type { RequestHandler } from "./$types";
import { ApiError, assertSameOrigin, handle, json, readJson, requireUser } from "#lib/server/api";
import { endpointPolicy, getKeyRing } from "#lib/server/config";
import { deleteConnection, getConnection, updateConnection } from "#lib/server/connections";
import { getDb } from "#lib/server/db";

const idParam = (params: Record<string, string>): string => {
    const id = params.id;
    if (!id) throw new ApiError(400, "invalid", "Missing connection id");
    return id;
};

export const GET: RequestHandler = handle(async ({ locals, params }) => {
    const user = requireUser(locals);
    const connection = await getConnection(getDb(env.DB), user.id, idParam(params));

    return json({ connection });
});

export const PATCH: RequestHandler = handle(async (event) => {
    const user = requireUser(event.locals);
    assertSameOrigin(event);

    const connection = await updateConnection({
        db: getDb(env.DB),
        ring: await getKeyRing(),
        userId: user.id,
        id: idParam(event.params),
        input: await readJson(event.request),
        policy: endpointPolicy()
    });

    return json({ connection });
});

export const DELETE: RequestHandler = handle(async (event) => {
    const user = requireUser(event.locals);
    assertSameOrigin(event);

    await deleteConnection(getDb(env.DB), user.id, idParam(event.params));

    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
});
