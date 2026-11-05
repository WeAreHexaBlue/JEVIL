import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import { getEditorTemplate } from "#lib/templates";
import { appDisplayFromBlueprint, type AppView } from "#lib/schema/app";
import Page from "./+page.svelte";

const blueprint = getEditorTemplate("palette-oracle")!.blueprint;
const display = appDisplayFromBlueprint(blueprint);

const app: AppView = {
    id: "app_1",
    slug: "palette-oracle",
    title: display.title,
    tagline: display.tagline,
    description: display.description,
    icon: display.icon,
    accent: display.accent,
    tags: display.tags,
    blueprint,
    draftRevision: 3,
    visibility: "draft",
    publishedVersionId: null,
    remixedFromAppId: null,
    remixedFromVersionId: null,
    createdAt: 0,
    updatedAt: 0,
    publishedAt: null
};

const renderPage = () =>
    render(Page, {
        props: {
            params: { id: app.id },
            form: null,
            data: {
                app,
                connections: [],
                user: null,
                providers: { google: false, github: false }
            }
        }
    }).body;

describe("editor page", () => {
    it("renders the editor shell around the draft", () => {
        const body = renderPage();

        expect(body).toContain("Palette Oracle");
        expect(body).toContain("/palette-oracle");
        expect(body).toContain("Components");
        expect(body).toContain("Test bench");
        expect(body).toContain('href="/me?tab=drafts"');
    });

    it("does not put the draft blueprint JSON in the page", () => {
        const body = renderPage();

        expect(body).not.toContain("jevil/app@1");
        expect(body).not.toContain("steps.read.family");
    });
});
