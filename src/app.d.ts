import type { User, Session } from "better-auth";
import { createAuth } from "#lib/server/auth.ts";

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
    namespace Cloudflare {
        interface Env {
            /** Rotation map; not listed in wrangler.jsonc because it is a secret. */
            ENCRYPTION_KEYS?: string;
        }
    }

    namespace App {
        interface Locals {
            user?: User;
            session?: Session;
            auth: ReturnType<typeof createAuth>;
        }

        // interface Error {}
        // interface PageData {}
        // interface PageState {}
    }
}

export {};
