import type { LayoutServerLoad } from './$types';
import { enabledSocialProviders } from '#lib/server/auth';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user ? { name: locals.user.name, email: locals.user.email } : null,
		providers: enabledSocialProviders
	};
};
