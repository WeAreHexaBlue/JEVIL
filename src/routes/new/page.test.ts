import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import { editorTemplateIds, getEditorTemplate } from "#lib/templates";
import { appDisplayFromBlueprint } from "#lib/schema/app";
import Page from "./+page.svelte";

const templates = editorTemplateIds.map((id) => {
    const blueprint = getEditorTemplate(id)!.blueprint;
    const display = appDisplayFromBlueprint(blueprint);

    return {
        id,
        title: display.title,
        tagline: display.tagline,
        icon: display.icon,
        accent: display.accent,
        tags: display.tags
    };
});

type NewForm = { error: string } | null;

const renderPage = (form: NewForm = null) =>
    render(Page, {
        props: {
            params: {},
            data: { templates, user: null, providers: { google: false, github: false } },
            form
        }
    }).body;

describe("new app page", () => {
    it("offers every editor template as a create form", () => {
        const body = renderPage();

        for (const template of templates) {
            expect(body).toContain(`value="${template.id}"`);
            expect(body).toContain(template.title);
            expect(body).toContain(template.tagline);
        }

        expect(body).toContain('action="?/create"');
        expect(body).toContain("Use template");
    });

    it("shows a safe error when creation fails", () => {
        const body = renderPage({ error: "That template does not exist" });

        expect(body).toContain('role="alert"');
        expect(body).toContain("That template does not exist");
    });
});
