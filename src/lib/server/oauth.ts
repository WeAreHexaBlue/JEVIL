import { fail, isRedirect, redirect } from '@sveltejs/kit';
import * as m from '#lib/paraglide/messages.js';

/**
 * Start an OAuth flow through Better Auth and hand the browser to the provider.
 * Returns a failure result only when the provider is unavailable.
 */
export const oauthAction = async (
	provider: 'google' | 'github',
	request: Request,
	locals: App.Locals,
	url: URL
) => {
	try {
		const result = await locals.auth.api.signInSocial({
			body: {
				provider,
				callbackURL: `${url.origin}/me`,
				errorCallbackURL: `${url.origin}/sign-in`
			},
			headers: request.headers
		});

		if (result.url) redirect(303, result.url);
	} catch (error) {
		if (isRedirect(error)) throw error;
		return fail(400, { error: m.auth_error_oauth() });
	}

	return fail(400, { error: m.auth_error_oauth() });
};
