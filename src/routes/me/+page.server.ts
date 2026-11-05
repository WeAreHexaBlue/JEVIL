import { env } from "cloudflare:workers";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { m } from "#lib/paraglide/messages";
import { listApps } from "#lib/server/apps";
import { authErrorCode } from "#lib/server/auth-errors";
import { getDb } from "#lib/server/db";
import { ensureProfile } from "#lib/server/profile";

const tabs = ["published", "drafts", "likes"] as const;
type Tab = (typeof tabs)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
    }

    const requested = url.searchParams.get("tab");
    const tab: Tab = tabs.includes(requested as Tab) ? (requested as Tab) : "published";

    const [profile, apps] = await Promise.all([
        ensureProfile(env.DB, locals.user),
        listApps(getDb(env.DB), locals.user.id)
    ]);

    // Card summaries only: full blueprints belong in the editor, not in every
    // profile page response.
    const drafts = apps
        .filter((app) => app.publishedVersionId === null)
        .map((app) => ({
            id: app.id,
            slug: app.slug,
            title: app.title,
            tagline: app.tagline,
            icon: app.icon,
            accent: app.accent,
            updatedAt: app.updatedAt
        }));

    return {
        user: locals.user,
        profile,
        tab,
        drafts,
        counts: { published: apps.length - drafts.length, drafts: drafts.length, likes: 0 }
    };
};

export const actions: Actions = {
    resend: async ({ locals, request, url }) => {
        if (!locals.user) {
            redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
        }

        try {
            await locals.auth.api.sendVerificationEmail({
                body: { email: locals.user.email, callbackURL: "/verify" },
                headers: request.headers
            });
        } catch (error) {
            if (authErrorCode(error) === "EMAIL_ALREADY_VERIFIED") {
                return fail(400, { error: m.verify_already() });
            }
            return fail(400, { error: m.auth_error_generic() });
        }

        return { verifySent: true };
    }
};
