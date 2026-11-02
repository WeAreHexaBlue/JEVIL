import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as m from '#lib/paraglide/messages.js';
import { emailSchema, passwordSchema } from '#lib/schema/primitives';
import { authErrorCode } from '#lib/server/auth-errors';
import { oauthAction } from '#lib/server/oauth';

const safeNext = (value: string | null): string =>
	value && value.startsWith('/') && !value.startsWith('//') ? value : '/me';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next')));
	return {};
};

export const actions: Actions = {
	email: async ({ request, locals }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');

		const parsedEmail = emailSchema.safeParse(email);
		const parsedPassword = passwordSchema.safeParse(password);

		if (!parsedEmail.success || !parsedPassword.success) {
			return fail(400, { error: m.auth_error_validation(), email });
		}

		try {
			await locals.auth.api.signInEmail({
				body: { email: parsedEmail.data, password: parsedPassword.data },
				headers: request.headers
			});
		} catch (error) {
			const code = authErrorCode(error);
			if (code === 'INVALID_EMAIL_OR_PASSWORD' || code === 'INVALID_PASSWORD') {
				return fail(400, { error: m.auth_error_invalid(), email });
			}
			return fail(400, { error: m.auth_error_generic(), email });
		}

		redirect(303, '/me');
	},

	google: ({ request, locals, url }) => oauthAction('google', request, locals, url),
	github: ({ request, locals, url }) => oauthAction('github', request, locals, url)
};
