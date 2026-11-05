import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import { getSeedApp, listSeedApps } from "#lib/templates";
import type { ConnectionView } from "#lib/schema/connection";
import Page from "./+page.svelte";
import SourcePage from "./source/+page.svelte";

const seed = () => getSeedApp("palette-oracle")!;

const connection = (overrides: Partial<ConnectionView> = {}): ConnectionView => ({
    id: "conn_1",
    provider: "laya",
    label: "Laya at home",
    baseUrl: "https://api.layaaimodel.com",
    model: "laya-1",
    config: {},
    authScheme: "bearer",
    status: "ok",
    lastCheckedAt: null,
    secretLast4: "1234",
    createdAt: 0,
    updatedAt: 0,
    ...overrides
});

const renderPage = (overrides: Record<string, unknown> = {}) => {
    const app = seed();
    return render(Page, {
        props: {
            params: { slug: app.slug },
            form: null,
            data: {
                slug: app.slug,
                blueprint: app.blueprint,
                connections: [],
                inputs: {},
                signedIn: false,
                user: null,
                providers: { google: false, github: false },
                ...overrides
            }
        }
    }).body;
};

describe("app detail page", () => {
    it("renders metadata, the sample result, and the decision panel", () => {
        const body = renderPage();

        expect(body).toContain("Palette Oracle");
        expect(body).toContain("A word goes in. A palette comes out.");
        expect(body).toContain("Sample result");
        expect(body).toContain("How this was decided");
        expect(body).toContain("earthy");
        expect(body).toContain("71% confident");
        expect(body).toContain("Read it again");
    });

    it("tells a guest how to connect a model", () => {
        const body = renderPage();

        expect(body).toContain("Connect a model to run this app.");
        expect(body).toContain("Sign in to use a saved connection.");
        expect(body).toContain('href="/settings/connections"');
    });

    it("lists a saved connection in the picker", () => {
        const body = renderPage({
            connections: [connection()],
            signedIn: true
        });

        expect(body).toContain("Laya at home");
        expect(body).toContain("Laya · laya-1");
        expect(body).not.toContain("Sign in to use a saved connection.");
        expect(body).not.toContain("1234");
    });

    it("applies a query override to the preview", () => {
        const body = renderPage({ inputs: { word: "comet" } });

        expect(body).toContain("“comet”");
        expect(body).not.toContain("“petrichor”");
    });

    it("renders user text as text, not markup", () => {
        const body = renderPage({ inputs: { word: "<script>alert(1)</script>" } });

        expect(body).not.toContain("<script>alert(1)</script>");
        expect(body).toContain("&lt;script>alert(1)&lt;/script>");
    });

    it("renders every seed without leaking a template", () => {
        for (const app of listSeedApps()) {
            const body = renderPage({ slug: app.slug, blueprint: app.blueprint });

            expect(body, app.slug).toContain(app.blueprint.meta.title);
            expect(body, app.slug).toContain(`/apps/${app.slug}/source`);
            expect(body, app.slug).not.toContain("{{");
        }
    });
});

describe("source page", () => {
    it("shows the blueprint as escaped JSON", () => {
        const app = seed();
        const { body } = render(SourcePage, {
            props: {
                params: { slug: app.slug },
                form: null,
                data: {
                    slug: app.slug,
                    title: app.blueprint.meta.title,
                    source: app.source,
                    user: null,
                    providers: { google: false, github: false }
                }
            }
        });

        expect(body).toContain("Blueprint source");
        expect(body).toContain("jevil/app@1");
        expect(body).toContain("Palette Oracle");
        expect(body).toContain("Back to Palette Oracle");
    });
});
