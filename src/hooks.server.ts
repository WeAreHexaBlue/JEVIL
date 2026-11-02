import { env } from 'cloudflare:workers';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { type Handle, sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { getAuth } from '#lib/server/auth.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

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
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		);
	});

export const handle: Handle = sequence(handleBetterAuth, handleParaglide);
