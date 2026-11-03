/**
 * Account connections (SPEC §9.2, §10.5, §10.6).
 *
 * Every function takes its dependencies explicitly so the module is testable
 * without a Worker: a Drizzle handle, a key ring, and the endpoint policy.
 * Routes own the environment lookup. Plaintext keys only exist inside this
 * module for the duration of a save or a decide call.
 */

import { and, desc, eq } from "drizzle-orm";
import {
    connectionConfigSchema,
    connectionCreateSchema,
    connectionPatchSchema,
    type ConnectionConfig,
    type ConnectionCreateInput,
    type ConnectionPatchInput,
    type ConnectionView
} from "#lib/schema/connection";
import type { ProviderId } from "#lib/schema/primitives";
import { decryptSecret, encryptSecret, type KeyRing } from "./crypto";
import type { getDb } from "./db";
import { connection } from "./db/schema";
import { getAdapter } from "./providers";
import type { ResolvedConnection, ValidationResult } from "./providers/base";
import { checkEndpointUrl, type EndpointPolicy } from "./ssrf";

type Database = ReturnType<typeof getDb>;
export type ConnectionRow = typeof connection.$inferSelect;

export type ConnectionErrorCode = "invalid" | "not_found";

/** A connection failure that is safe to return to the client. */
export class ConnectionError extends Error {
    readonly code: ConnectionErrorCode;

    constructor(code: ConnectionErrorCode, message: string) {
        super(message);
        this.name = "ConnectionError";
        this.code = code;
    }
}

const invalid = (message: string): never => {
    throw new ConnectionError("invalid", message);
};

/** Hosted providers need a credential; a custom endpoint may be anonymous. */
const needsSecret = (provider: ProviderId): boolean => provider !== "systemone";

interface NormalizedInput {
    baseUrl: string;
    model: string | null;
    config: ConnectionConfig;
}

export const normalizeConnectionInput = (
    input: {
        provider: ProviderId;
        baseUrl?: string;
        model?: string;
        config?: ConnectionConfig;
    },
    policy: EndpointPolicy
): NormalizedInput => {
    const config = input.config ?? {};
    const baseUrl = (input.baseUrl ?? "").trim();

    if (input.provider === "systemone" && baseUrl.length === 0) {
        invalid("A custom endpoint needs a URL");
    }

    if (baseUrl.length > 0) {
        const checked = checkEndpointUrl(baseUrl, policy);
        if (!checked.ok) invalid(checked.message);
    }

    if (input.provider === "cloudflare" && !config.accountId) {
        invalid("Cloudflare connections need an account id");
    }

    if (config.headerName && input.provider !== "systemone") {
        invalid("Only a custom endpoint can use a custom header");
    }

    const model = input.model?.trim() ?? "";

    return {
        baseUrl,
        model: model.length > 0 ? model : null,
        config
    };
};

export const authSchemeFor = (
    provider: ProviderId,
    config: ConnectionConfig,
    hasSecret: boolean,
    requested?: "bearer" | "header" | "none"
): "bearer" | "header" | "none" => {
    if (provider !== "systemone") return "bearer";
    if (!hasSecret) return "none";
    if (config.headerName) return "header";
    return requested === "none" ? "none" : "bearer";
};

const parseConfig = (configJson: string): ConnectionConfig => {
    try {
        const parsed = connectionConfigSchema.safeParse(JSON.parse(configJson));
        return parsed.success ? parsed.data : {};
    } catch {
        return {};
    }
};

export const toConnectionView = (row: ConnectionRow): ConnectionView => ({
    id: row.id,
    provider: row.provider,
    label: row.label,
    baseUrl: row.baseUrl,
    model: row.model,
    config: parseConfig(row.configJson),
    authScheme: row.authScheme,
    status: row.status,
    lastCheckedAt: row.lastCheckedAt?.getTime() ?? null,
    secretLast4: row.secretLast4,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime()
});

const last4 = (secret: string): string => secret.slice(-4);

export interface CreateConnectionArgs {
    db: Database;
    ring: KeyRing;
    userId: string;
    input: unknown;
    policy: EndpointPolicy;
}

export const createConnection = async ({
    db,
    ring,
    userId,
    input,
    policy
}: CreateConnectionArgs): Promise<ConnectionView> => {
    const parsed = connectionCreateSchema.safeParse(input);
    if (!parsed.success)
        throw new ConnectionError("invalid", "Check the connection details and try again");
    const data: ConnectionCreateInput = parsed.data;

    const secret = data.secret?.trim();
    if (needsSecret(data.provider) && !secret) invalid("This provider needs a credential");

    const normalized = normalizeConnectionInput(data, policy);
    const id = crypto.randomUUID();

    const encrypted = secret
        ? await encryptSecret(secret, { userId, connectionId: id, provider: data.provider }, ring)
        : null;

    const [row] = await db
        .insert(connection)
        .values({
            id,
            userId,
            provider: data.provider,
            label: data.label,
            baseUrl: normalized.baseUrl,
            model: normalized.model,
            configJson: JSON.stringify(normalized.config),
            authScheme: authSchemeFor(
                data.provider,
                normalized.config,
                Boolean(secret),
                data.authScheme
            ),
            secretCt: encrypted?.ciphertext ?? null,
            secretIv: encrypted?.iv ?? null,
            keyVersion: encrypted?.version ?? null,
            secretLast4: secret ? last4(secret) : null,
            status: "unchecked"
        })
        .returning();

    return toConnectionView(row);
};

export const listConnections = async (db: Database, userId: string): Promise<ConnectionView[]> => {
    const rows = await db
        .select()
        .from(connection)
        .where(eq(connection.userId, userId))
        .orderBy(desc(connection.updatedAt));

    return rows.map(toConnectionView);
};

const findOwned = async (
    db: Database,
    userId: string,
    id: string
): Promise<ConnectionRow | null> => {
    const [row] = await db
        .select()
        .from(connection)
        .where(and(eq(connection.id, id), eq(connection.userId, userId)))
        .limit(1);

    return row ?? null;
};

/** The raw row (including ciphertext) for server-side calls. */
export const getConnectionRow = findOwned;

export const getConnection = async (
    db: Database,
    userId: string,
    id: string
): Promise<ConnectionView> => {
    const row = await findOwned(db, userId, id);
    if (!row) throw new ConnectionError("not_found", "That connection does not exist");
    return toConnectionView(row);
};

export interface UpdateConnectionArgs {
    db: Database;
    ring: KeyRing;
    userId: string;
    id: string;
    input: unknown;
    policy: EndpointPolicy;
}

export const updateConnection = async ({
    db,
    ring,
    userId,
    id,
    input,
    policy
}: UpdateConnectionArgs): Promise<ConnectionView> => {
    const row = await findOwned(db, userId, id);
    if (!row) throw new ConnectionError("not_found", "That connection does not exist");

    const parsed = connectionPatchSchema.safeParse(input);
    if (!parsed.success)
        throw new ConnectionError("invalid", "Check the connection details and try again");
    const data: ConnectionPatchInput = parsed.data;

    const secret = data.secret?.trim();
    const config = data.config ?? parseConfig(row.configJson);
    const normalized = normalizeConnectionInput(
        {
            provider: row.provider,
            baseUrl: data.baseUrl ?? row.baseUrl,
            model: data.model ?? row.model ?? undefined,
            config
        },
        policy
    );

    const encrypted = secret
        ? await encryptSecret(
              secret,
              { userId, connectionId: row.id, provider: row.provider },
              ring
          )
        : null;

    const hasSecret = Boolean(secret) || row.secretCt !== null;

    const [updated] = await db
        .update(connection)
        .set({
            label: data.label ?? row.label,
            baseUrl: normalized.baseUrl,
            model: normalized.model,
            configJson: JSON.stringify(normalized.config),
            authScheme: authSchemeFor(
                row.provider,
                normalized.config,
                hasSecret,
                data.authScheme ?? row.authScheme
            ),
            ...(encrypted
                ? {
                      secretCt: encrypted.ciphertext,
                      secretIv: encrypted.iv,
                      keyVersion: encrypted.version,
                      secretLast4: secret ? last4(secret) : null,
                      status: "unchecked" as const,
                      lastCheckedAt: null
                  }
                : {})
        })
        .where(and(eq(connection.id, row.id), eq(connection.userId, userId)))
        .returning();

    return toConnectionView(updated);
};

export const deleteConnection = async (db: Database, userId: string, id: string): Promise<void> => {
    const deleted = await db
        .delete(connection)
        .where(and(eq(connection.id, id), eq(connection.userId, userId)))
        .returning({ id: connection.id });

    if (deleted.length === 0) {
        throw new ConnectionError("not_found", "That connection does not exist");
    }
};

/** Decrypt a row into the shape an adapter expects. Server-side only. */
export const resolveConnection = async (
    row: ConnectionRow,
    ring: KeyRing
): Promise<ResolvedConnection> => {
    const secret =
        row.secretCt && row.secretIv && row.keyVersion !== null
            ? await decryptSecret(
                  { ciphertext: row.secretCt, iv: row.secretIv, version: row.keyVersion },
                  { userId: row.userId, connectionId: row.id, provider: row.provider },
                  ring
              )
            : undefined;

    return {
        provider: row.provider,
        baseUrl: row.baseUrl,
        model: row.model ?? undefined,
        config: parseConfig(row.configJson),
        secret
    };
};

export interface TestConnectionArgs {
    db: Database;
    ring: KeyRing;
    userId: string;
    id: string;
    policy: EndpointPolicy;
}

/**
 * Run an adapter's configuration/health check and record the outcome.
 * The result never contains a key, a URL, or a provider payload.
 */
export const testConnection = async ({
    db,
    ring,
    userId,
    id,
    policy
}: TestConnectionArgs): Promise<ValidationResult & { connection: ConnectionView }> => {
    const row = await findOwned(db, userId, id);
    if (!row) throw new ConnectionError("not_found", "That connection does not exist");

    const resolved = await resolveConnection(row, ring);

    if (resolved.baseUrl) {
        const checked = checkEndpointUrl(resolved.baseUrl, policy);
        if (!checked.ok) {
            const view = await recordStatus(db, row, "error");
            return { ok: false, error: "validation", connection: view };
        }
    }

    const result = await getAdapter(row.provider).validate(resolved);
    const view = await recordStatus(db, row, result.ok ? "ok" : "error");

    return { ...result, connection: view };
};

const recordStatus = async (
    db: Database,
    row: ConnectionRow,
    status: "ok" | "error"
): Promise<ConnectionView> => {
    const [updated] = await db
        .update(connection)
        .set({ status, lastCheckedAt: new Date() })
        .where(and(eq(connection.id, row.id), eq(connection.userId, row.userId)))
        .returning();

    return toConnectionView(updated);
};
