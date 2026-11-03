/**
 * Environment-derived server configuration.
 *
 * This is the only place connection code reads Worker bindings, so tests can
 * pass an explicit policy and key ring instead of importing `cloudflare:workers`.
 */

import { env } from "cloudflare:workers";
import { createKeyRing, type KeyRing } from "./crypto";
import type { EndpointPolicy } from "./ssrf";

export const endpointPolicy = (): EndpointPolicy => {
    // Widen the generated literal types so a production build's vars are checked.
    const environment: string = env.ENVIRONMENT;
    const allowLocal: string = env.ALLOW_LOCAL_ENDPOINTS;

    return {
        production: environment === "production",
        // Anything except an explicit `true` keeps local endpoints off.
        allowLocal: allowLocal === "true"
    };
};

let ring: Promise<KeyRing> | undefined;

/** The key ring is immutable for the lifetime of the isolate. */
export const getKeyRing = (): Promise<KeyRing> => {
    ring ??= createKeyRing({
        ENCRYPTION_KEY: env.ENCRYPTION_KEY,
        ENCRYPTION_KEYS: env.ENCRYPTION_KEYS
    }).catch((error: unknown) => {
        // A missing or broken key can be fixed by redeploying; do not cache it.
        ring = undefined;
        throw error;
    });

    return ring;
};
