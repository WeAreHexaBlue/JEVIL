import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET
} from '$app/env/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb } from '#lib/server/db/index.ts';

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
	socialProviders.google = {
		clientId: GOOGLE_CLIENT_ID,
		clientSecret: GOOGLE_CLIENT_SECRET
	};
}

if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
	socialProviders.github = {
		clientId: GITHUB_CLIENT_ID,
		clientSecret: GITHUB_CLIENT_SECRET
	};
}

/** Providers with credentials configured. Used to render only working OAuth buttons. */
export const enabledSocialProviders = {
	google: Boolean(socialProviders.google),
	github: Boolean(socialProviders.github)
};

const authConfig = {
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	emailAndPassword: {
		enabled: true
	},
	socialProviders,
	advanced: {
		useSecureCookies: ORIGIN.startsWith('https://'),
		defaultCookieAttributes: {
			httpOnly: true,
			sameSite: 'lax'
		}
	},
	plugins: [
		// Keep this last: it bridges Better Auth cookies into SvelteKit's cookie API.
		sveltekitCookies(getRequestEvent)
	]
} satisfies Omit<Parameters<typeof betterAuth>[0], 'database'>;

export const createAuth = (d1: D1Database) =>
	betterAuth({
		...authConfig,
		database: drizzleAdapter(getDb(d1), { provider: 'sqlite' })
	});

export type Auth = ReturnType<typeof createAuth>;

const authByBinding = new WeakMap<D1Database, Auth>();

/** One Better Auth instance per D1 binding, reused across requests in the same isolate. */
export const getAuth = (d1: D1Database): Auth => {
	let auth = authByBinding.get(d1);
	if (!auth) {
		auth = createAuth(d1);
		authByBinding.set(d1, auth);
	}
	return auth;
};
