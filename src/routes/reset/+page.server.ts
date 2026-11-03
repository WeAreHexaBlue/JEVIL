import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { m } from "#lib/paraglide/messages";
import { emailSchema, passwordSchema } from "#lib/schema/primitives";

export const load: PageServerLoad = async ({ url }) => {
    return {
        token: url.searchParams.get("token"),
        failed: Boolean(url.searchParams.get("error"))
    };
};

export const actions: Actions = {
    request: async ({ request, locals }) => {
        const form = await request.formData();
        const email = String(form.get("email") ?? "");

        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) return fail(400, { error: m.auth_error_validation(), email });

        try {
            await locals.auth.api.requestPasswordReset({
                body: { email: parsed.data, redirectTo: "/reset" },
                headers: request.headers
            });
        } catch {
            // Always answer the same way so the form can't be used to probe accounts.
        }

        return { sent: true, email: parsed.data };
    },

    reset: async ({ request, locals }) => {
        const form = await request.formData();
        const token = String(form.get("token") ?? "");
        const password = String(form.get("password") ?? "");

        if (!token) return fail(400, { error: m.reset_error_body(), token: "" });

        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) return fail(400, { error: m.auth_error_validation(), token });

        try {
            await locals.auth.api.resetPassword({
                body: { token, newPassword: parsed.data },
                headers: request.headers
            });
        } catch {
            return fail(400, { error: m.reset_error_body(), token });
        }

        redirect(303, "/sign-in?reset=1");
    }
};
