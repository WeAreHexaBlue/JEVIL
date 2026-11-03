import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { m } from "#lib/paraglide/messages";
import { displayNameSchema, emailSchema, passwordSchema } from "#lib/schema/primitives";
import { authErrorCode } from "#lib/server/auth-errors";
import { oauthAction } from "#lib/server/oauth";

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) redirect(303, "/me");
    return {};
};

export const actions: Actions = {
    email: async ({ request, locals }) => {
        const form = await request.formData();
        const name = String(form.get("name") ?? "");
        const email = String(form.get("email") ?? "");
        const password = String(form.get("password") ?? "");

        const parsedName = displayNameSchema.safeParse(name);
        const parsedEmail = emailSchema.safeParse(email);
        const parsedPassword = passwordSchema.safeParse(password);

        if (!parsedName.success || !parsedEmail.success || !parsedPassword.success) {
            return fail(400, { error: m.auth_error_validation(), name, email });
        }

        try {
            await locals.auth.api.signUpEmail({
                body: {
                    name: parsedName.data,
                    email: parsedEmail.data,
                    password: parsedPassword.data
                },
                headers: request.headers
            });
        } catch (error) {
            const code = authErrorCode(error);
            if (
                code === "USER_ALREADY_EXISTS" ||
                code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
            ) {
                return fail(400, { error: m.auth_error_exists(), name, email });
            }
            if (code === "PASSWORD_TOO_SHORT" || code === "INVALID_EMAIL") {
                return fail(400, { error: m.auth_error_validation(), name, email });
            }
            return fail(400, { error: m.auth_error_generic(), name, email });
        }

        redirect(303, "/me");
    },

    google: ({ request, locals, url }) => oauthAction("google", request, locals, url),
    github: ({ request, locals, url }) => oauthAction("github", request, locals, url)
};
