import { env } from "cloudflare:workers";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { listConnections } from "#lib/server/connections";
import { getDb } from "#lib/server/db";
import { getSeedApp } from "#lib/templates";

export const load: PageServerLoad = async ({ params, url, locals }) => {
    const seed = getSeedApp(params.slug);
    if (!seed) error(404, "That app does not exist.");

    // Query overrides are coerced by the runner; clipping here keeps a huge URL
    // from becoming a huge request body before it has a chance to fail.
    const inputs: Record<string, string> = {};
    for (const input of seed.blueprint.inputs) {
        const value = url.searchParams.get(input.id);
        if (value !== null) inputs[input.id] = value.slice(0, input.maxLength ?? 4000);
    }

    const connections = locals.user ? await listConnections(getDb(env.DB), locals.user.id) : [];

    return {
        slug: seed.slug,
        blueprint: seed.blueprint,
        connections,
        inputs,
        signedIn: Boolean(locals.user)
    };
};
