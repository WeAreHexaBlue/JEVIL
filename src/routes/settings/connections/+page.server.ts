import { env } from "cloudflare:workers";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { m } from "#lib/paraglide/messages";
import { CryptoConfigError, DecryptionError } from "#lib/server/crypto";
import { endpointPolicy, getKeyRing } from "#lib/server/config";
import {
    createConnection,
    deleteConnection,
    listConnections,
    testConnection,
    updateConnection,
    ConnectionError
} from "#lib/server/connections";
import { getDb } from "#lib/server/db";
import { adapterList } from "#lib/server/providers";

const text = (data: FormData, key: string): string => String(data.get(key) ?? "").trim();

const config = (data: FormData): Record<string, string> => {
    const values: Record<string, string> = {};
    const accountId = text(data, "accountId");
    const headerName = text(data, "headerName");
    if (accountId) values.accountId = accountId;
    if (headerName) values.headerName = headerName;
    return values;
};

const providerInfo = adapterList.map((adapter) => ({
    id: adapter.id,
    defaultBaseUrl: adapter.defaultBaseUrl,
    defaultModel: adapter.defaultModel ?? null,
    models: adapter.models,
    capabilities: adapter.capabilities,
    requiresBaseUrl: adapter.id === "systemone",
    requiresAccountId: adapter.id === "cloudflare",
    allowsHeader: adapter.id === "systemone"
}));

const errorMessage = (error: unknown): string => {
    if (error instanceof ConnectionError) return error.message;
    if (error instanceof DecryptionError) return m.connections_error_decrypt();
    if (error instanceof CryptoConfigError) return m.connections_error_config();
    return m.connections_invalid();
};

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
    }

    return {
        connections: await listConnections(getDb(env.DB), locals.user.id),
        providers: providerInfo,
        notice: url.searchParams.get("notice")
    };
};

export const actions: Actions = {
    create: async ({ locals, request }) => {
        if (!locals.user) redirect(303, "/sign-in?next=/settings/connections");

        const data = await request.formData();
        const values = {
            provider: text(data, "provider"),
            label: text(data, "label"),
            baseUrl: text(data, "baseUrl"),
            model: text(data, "model"),
            accountId: text(data, "accountId"),
            headerName: text(data, "headerName")
        };

        try {
            await createConnection({
                db: getDb(env.DB),
                ring: await getKeyRing(),
                userId: locals.user.id,
                input: {
                    provider: values.provider,
                    label: values.label,
                    baseUrl: values.baseUrl,
                    model: values.model || undefined,
                    secret: text(data, "secret") || undefined,
                    config: config(data)
                },
                policy: endpointPolicy()
            });
        } catch (error) {
            return fail(400, { action: "create", error: errorMessage(error), values });
        }

        redirect(303, "/settings/connections?notice=created");
    },

    update: async ({ locals, request }) => {
        if (!locals.user) redirect(303, "/sign-in?next=/settings/connections");

        const data = await request.formData();
        const id = text(data, "id");
        if (!id) return fail(400, { action: "update", error: m.connections_invalid() });

        const values = {
            label: text(data, "label"),
            baseUrl: text(data, "baseUrl"),
            model: text(data, "model"),
            accountId: text(data, "accountId"),
            headerName: text(data, "headerName")
        };

        try {
            await updateConnection({
                db: getDb(env.DB),
                ring: await getKeyRing(),
                userId: locals.user.id,
                id,
                input: {
                    label: values.label,
                    baseUrl: values.baseUrl,
                    model: values.model || undefined,
                    secret: text(data, "secret") || undefined,
                    config: config(data)
                },
                policy: endpointPolicy()
            });
        } catch (error) {
            return fail(400, { action: "update", id, error: errorMessage(error), values });
        }

        redirect(303, "/settings/connections?notice=saved");
    },

    delete: async ({ locals, request }) => {
        if (!locals.user) redirect(303, "/sign-in?next=/settings/connections");

        const data = await request.formData();
        const id = text(data, "id");
        if (!id) return fail(400, { action: "delete", error: m.connections_invalid() });

        try {
            await deleteConnection(getDb(env.DB), locals.user.id, id);
        } catch (error) {
            return fail(400, { action: "delete", error: errorMessage(error) });
        }

        redirect(303, "/settings/connections?notice=deleted");
    },

    test: async ({ locals, request }) => {
        if (!locals.user) redirect(303, "/sign-in?next=/settings/connections");

        const data = await request.formData();
        const id = text(data, "id");
        if (!id) return fail(400, { action: "test", error: m.connections_invalid() });

        try {
            const result = await testConnection({
                db: getDb(env.DB),
                ring: await getKeyRing(),
                userId: locals.user.id,
                id,
                policy: endpointPolicy()
            });

            return { action: "test", id, tested: result.ok, code: result.error ?? null };
        } catch (error) {
            return fail(400, { action: "test", id, error: errorMessage(error) });
        }
    }
};
