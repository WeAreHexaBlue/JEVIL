import type { PageServerLoad } from "./$types";
import { listSeedApps } from "#lib/templates";

export const load: PageServerLoad = async ({ url }) => {
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const search = q.toLowerCase();

    const apps = listSeedApps()
        .map((app) => ({
            slug: app.slug,
            title: app.blueprint.meta.title,
            tagline: app.blueprint.meta.tagline,
            tags: app.blueprint.meta.tags,
            accent: app.blueprint.meta.accent,
            icon: app.blueprint.meta.icon
        }))
        .filter(
            (app) =>
                search.length === 0 ||
                app.title.toLowerCase().includes(search) ||
                app.tagline.toLowerCase().includes(search) ||
                app.tags.some((tag) => tag.toLowerCase().includes(search))
        );

    return { q, apps };
};
