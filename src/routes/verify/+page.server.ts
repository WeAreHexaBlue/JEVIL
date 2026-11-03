import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { m } from "#lib/paraglide/messages";
import { authErrorCode } from "#lib/server/auth-errors";

export const load: PageServerLoad = async ({ locals, url }) => {
    return {
        email: locals.user?.email ?? null,
        verified: Boolean(locals.user?.emailVerified),
        failed: Boolean(url.searchParams.get("error"))
    };
};

export const actions: Actions = {
    resend: async ({ locals, request }) => {
        if (!locals.user) return fail(401, { error: m.verify_signed_out() });

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

        return { sent: true };
    }
};
