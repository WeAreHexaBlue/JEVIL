/**
 * Maker apps: draft persistence and snapshots (SPEC §9.2, §12.4).
 *
 * Every function takes its Drizzle handle explicitly so the module stays
 * testable without a Worker. Routes own `env`, auth, and response shapes.
 *
 * Drafts are loose by design. `PATCH` checks size, not `jevil/app@1`
 * semantics; the editor validates continuously and publish is the gate.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import {
    MAX_BLUEPRINT_BYTES,
    appCreateSchema,
    appDisplayFromBlueprint,
    appPatchSchema,
    appSlugBase,
    appSlugCandidate,
    parseStoredJson,
    parseTags,
    type AppDisplay,
    type AppView
} from "#lib/schema/app";
import { isUniqueViolation } from "#lib/schema/primitives";
import { getEditorTemplate } from "#lib/templates";
import type { getDb } from "./db";
import { app } from "./db/schema";

type Database = ReturnType<typeof getDb>;
export type AppRow = typeof app.$inferSelect;

export type AppErrorCode = "invalid" | "not_found" | "conflict";

/** An app failure that is safe to return to the client. */
export class AppError extends Error {
    readonly code: AppErrorCode;
    /** Present on `conflict`: the revision currently in the database. */
    readonly revision?: number;

    constructor(code: AppErrorCode, message: string, revision?: number) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.revision = revision;
    }
}

const invalid: (message: string) => never = (message) => {
    throw new AppError("invalid", message);
};

const encoder = new TextEncoder();

const encodeBlueprint = (blueprint: unknown): string => {
    let json: string | undefined;

    try {
        json = JSON.stringify(blueprint);
    } catch {
        invalid("That blueprint cannot be saved");
    }

    if (json === undefined) invalid("Send a blueprint");

    if (encoder.encode(json).byteLength > MAX_BLUEPRINT_BYTES) {
        invalid("That blueprint is too large");
    }

    return json;
};

const displayColumns = (display: AppDisplay) => ({
    title: display.title,
    tagline: display.tagline,
    description: display.description,
    icon: display.icon,
    accent: display.accent,
    tagsJson: JSON.stringify(display.tags)
});

export const toAppView = (row: AppRow): AppView => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    icon: row.icon,
    accent: row.accent,
    tags: parseTags(row.tagsJson),
    blueprint: parseStoredJson(row.blueprintJson),
    draftRevision: row.draftRevision,
    visibility: row.visibility,
    publishedVersionId: row.publishedVersionId,
    remixedFromAppId: row.remixedFromAppId,
    remixedFromVersionId: row.remixedFromVersionId,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    publishedAt: row.publishedAt?.getTime() ?? null
});

const findOwned = async (db: Database, userId: string, id: string): Promise<AppRow | null> => {
    const [row] = await db
        .select()
        .from(app)
        .where(and(eq(app.id, id), eq(app.ownerId, userId)))
        .limit(1);

    return row ?? null;
};

export interface CreateAppArgs {
    db: Database;
    userId: string;
    input: unknown;
}

/**
 * Create a draft from a starting template. The slug is derived from the title
 * and suffixed on collision; a race that trips the unique index is retried.
 */
export const createApp = async ({ db, userId, input }: CreateAppArgs): Promise<AppView> => {
    const parsed = appCreateSchema.safeParse(input);
    if (!parsed.success) invalid("Choose a starting template");

    const template = getEditorTemplate(parsed.data.template);
    if (!template) invalid("That template does not exist");

    const blueprintJson = encodeBlueprint(template.blueprint);
    const display = appDisplayFromBlueprint(template.blueprint);
    const base = appSlugBase(display.title);
    const id = crypto.randomUUID();

    for (let attempt = 0; attempt < 32; attempt += 1) {
        const slug = appSlugCandidate(base, attempt);

        const [taken] = await db
            .select({ id: app.id })
            .from(app)
            .where(eq(app.slug, slug))
            .limit(1);

        if (taken) continue;

        try {
            const [row] = await db
                .insert(app)
                .values({
                    id,
                    ownerId: userId,
                    slug,
                    blueprintJson,
                    draftRevision: 1,
                    ...displayColumns(display)
                })
                .returning();

            return toAppView(row);
        } catch (error) {
            if (isUniqueViolation(error)) continue;
            throw error;
        }
    }

    return invalid("Could not find a free URL for that title");
};

export const listApps = async (db: Database, userId: string): Promise<AppView[]> => {
    const rows = await db
        .select()
        .from(app)
        .where(eq(app.ownerId, userId))
        .orderBy(desc(app.updatedAt));

    return rows.map(toAppView);
};

export const getApp = async (db: Database, userId: string, id: string): Promise<AppView> => {
    const row = await findOwned(db, userId, id);
    if (!row) throw new AppError("not_found", "That app does not exist");
    return toAppView(row);
};

export interface UpdateAppArgs {
    db: Database;
    userId: string;
    id: string;
    input: unknown;
}

/**
 * Save a draft. The update is conditional on `revision`, so two tabs cannot
 * silently overwrite each other. A stale write returns the current revision.
 */
export const updateApp = async ({ db, userId, id, input }: UpdateAppArgs): Promise<AppView> => {
    const parsed = appPatchSchema.safeParse(input);
    if (!parsed.success) invalid("Check the draft before saving");

    const blueprintJson = encodeBlueprint(parsed.data.blueprint);
    const display = appDisplayFromBlueprint(parsed.data.blueprint);

    const [row] = await db
        .update(app)
        .set({
            blueprintJson,
            draftRevision: sql`${app.draftRevision} + 1`,
            updatedAt: new Date(),
            ...displayColumns(display)
        })
        .where(
            and(
                eq(app.id, id),
                eq(app.ownerId, userId),
                eq(app.draftRevision, parsed.data.revision)
            )
        )
        .returning();

    if (row) return toAppView(row);

    const existing = await findOwned(db, userId, id);
    if (!existing) throw new AppError("not_found", "That app does not exist");

    throw new AppError(
        "conflict",
        "This app changed in another tab. Reload to get the latest draft.",
        existing.draftRevision
    );
};
