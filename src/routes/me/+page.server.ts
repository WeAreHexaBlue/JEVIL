import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ensureProfile } from '#lib/server/profile';

const tabs = ['published', 'drafts', 'likes'] as const;
type Tab = (typeof tabs)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
	}

	const requested = url.searchParams.get('tab');
	const tab: Tab = tabs.includes(requested as Tab) ? (requested as Tab) : 'published';

	const profile = await ensureProfile(env.DB, locals.user);

	return {
		user: locals.user,
		profile,
		tab,
		counts: { published: 0, drafts: 0, likes: 0 }
	};
};
