import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { getSeedApp } from "#lib/templates";

export const load: PageServerLoad = async ({ params }) => {
    const seed = getSeedApp(params.slug);
    if (!seed) error(404, "That app does not exist.");

    return {
        slug: seed.slug,
        title: seed.blueprint.meta.title,
        source: seed.source
    };
};
