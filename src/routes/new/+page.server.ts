import { env } from "cloudflare:workers";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { appDisplayFromBlueprint } from "#lib/schema/app";
import { AppError, createApp } from "#lib/server/apps";
import { getDb } from "#lib/server/db";
import { editorTemplateIds, getEditorTemplate } from "#lib/templates";

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
    }

    const templates = editorTemplateIds.flatMap((id) => {
        const template = getEditorTemplate(id);
        if (!template) return [];

        const display = appDisplayFromBlueprint(template.blueprint);

        return [
            {
                id,
                title: display.title,
                tagline: display.tagline,
                icon: display.icon,
                accent: display.accent,
                tags: display.tags
            }
        ];
    });

    return { templates };
};

export const actions: Actions = {
    create: async ({ locals, request }) => {
        if (!locals.user) redirect(303, "/sign-in?next=/new");

        const data = await request.formData();
        const template = String(data.get("template") ?? "");

        let id: string;

        try {
            const app = await createApp({
                db: getDb(env.DB),
                userId: locals.user.id,
                input: { template }
            });
            id = app.id;
        } catch (error) {
            if (error instanceof AppError) return fail(400, { error: error.message });
            throw error;
        }

        redirect(303, `/edit/${id}`);
    }
};
