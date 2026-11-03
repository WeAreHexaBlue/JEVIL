import { env } from "cloudflare:workers";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { m } from "#lib/paraglide/messages";
import { authErrorCode } from "#lib/server/auth-errors";
import { ensureProfile } from "#lib/server/profile";

const tabs = ["published", "drafts", "likes"] as const;
type Tab = (typeof tabs)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
    }

    const requested = url.searchParams.get("tab");
    const tab: Tab = tabs.includes(requested as Tab) ? (requested as Tab) : "published";

    const profile = await ensureProfile(env.DB, locals.user);

    return {
        user: locals.user,
        profile,
        tab,
        counts: { published: 0, drafts: 0, likes: 0 }
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
