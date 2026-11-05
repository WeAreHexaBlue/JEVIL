import { env } from "cloudflare:workers";
import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { AppError, getApp } from "#lib/server/apps";
import { listConnections } from "#lib/server/connections";
import { getDb } from "#lib/server/db";

export const load: PageServerLoad = async ({ locals, params, url }) => {
    if (!locals.user) {
        redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
    }

    const db = getDb(env.DB);

    try {
        const [app, connections] = await Promise.all([
            getApp(db, locals.user.id, params.id),
            listConnections(db, locals.user.id)
        ]);

        return { app, connections };
    } catch (cause) {
        if (cause instanceof AppError && cause.code === "not_found") {
            error(404, "That app does not exist.");
        }
        throw cause;
    }
};
