import { env } from "cloudflare:workers";
import { getTextDirection } from "#lib/paraglide/runtime.js";
import { paraglideMiddleware } from "#lib/paraglide/server.js";
import { type Handle, type HandleServerError, sequence } from "@sveltejs/kit/hooks";
import { building } from "$app/env";
import { getAuth } from "#lib/server/auth.ts";
import { logEvent } from "#lib/server/log.ts";
import { safeError } from "#lib/server/redact.ts";
import { svelteKitHandler } from "better-auth/svelte-kit";

const handleBetterAuth: Handle = async ({ event, resolve }) => {
    if (building) return resolve(event);

    const db = env.DB;
    if (!db) throw new Error('D1 binding "DB" not found - are you running with wrangler?');

    const auth = getAuth(db);
    event.locals.auth = auth;

    const session = await auth.api.getSession({ headers: event.request.headers });

    if (session) {
        event.locals.session = session.session;
        event.locals.user = session.user;
    }

    return svelteKitHandler({ event, resolve, auth, building });
};

const handleParaglide: Handle = ({ event, resolve }) =>
    paraglideMiddleware(event.request, ({ request, locale }) => {
        return resolve(
            { ...event, request },
            {
                transformPageChunk: ({ html }) =>
                    html
                        .replace("%paraglide.lang%", locale)
                        .replace("%paraglide.dir%", getTextDirection(locale))
            }
        );
    });

export const handle: Handle = sequence(handleBetterAuth, handleParaglide);

export const handleError: HandleServerError = ({ kind, error, event }) => {
    const known = kind === "app" || kind === "framework" || kind === "validation";

    logEvent("error", "request_failed", {
        kind,
        // Route ids, not URLs: query strings can carry tokens.
        route: event.route.id ?? "unmatched",
        status: known ? error.status : 500,
        // SvelteKit's own messages are safe; anything else may be a provider payload.
        error: known ? { errorName: kind, errorMessage: error.message } : safeError(error)
    });
};
