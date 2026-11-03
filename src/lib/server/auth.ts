import {
    ORIGIN,
    BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET
} from "$app/env/private";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { getDb } from "#lib/server/db/index.ts";
import { sendPasswordResetEmail, sendVerificationEmail } from "#lib/server/email.ts";

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

/**
 * Better Auth builds its own callback URL for the verification link. Point it at
 * our `/verify` page so the click lands somewhere that explains what happened.
 */
const withCallback = (url: string, path: string): string => {
    const parsed = new URL(url);
    parsed.searchParams.set("callbackURL", path);
    return parsed.toString();
};

const authConfig = {
    baseURL: ORIGIN,
    secret: BETTER_AUTH_SECRET,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        // Verification gates publishing only; people can sign in and run apps without it.
        requireEmailVerification: false,
        resetPasswordTokenExpiresIn: 60 * 60,
        sendResetPassword: async ({ user, url }) => {
            await sendPasswordResetEmail({ user, url });
        }
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        expiresIn: 60 * 60,
        sendVerificationEmail: async ({ user, url }) => {
            await sendVerificationEmail({ user, url: withCallback(url, "/verify") });
        }
    },
    socialProviders,
    advanced: {
        useSecureCookies: ORIGIN.startsWith("https://"),
        defaultCookieAttributes: {
            httpOnly: true,
            sameSite: "lax"
        }
    },
    plugins: [
        // Keep this last: it bridges Better Auth cookies into SvelteKit's cookie API.
        sveltekitCookies(getRequestEvent)
    ]
} satisfies Omit<Parameters<typeof betterAuth>[0], "database">;

export const createAuth = (d1: D1Database) =>
    betterAuth({
        ...authConfig,
        database: drizzleAdapter(getDb(d1), { provider: "sqlite" })
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
