import { relations } from "drizzle-orm";
import {
    index,
    integer,
    primaryKey,
    sqliteTable,
    text,
    uniqueIndex
} from "drizzle-orm/sqlite-core";
import { user } from "./auth.schema";

/**
 * Public-facing maker profile. One row per Better Auth user, created lazily on
 * first authenticated page load.
 */
export const profile = sqliteTable("profile", {
    userId: text("user_id")
        .primaryKey()
        .references(() => user.id, { onDelete: "cascade" }),
    handle: text("handle").notNull().unique(),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    avatarSeed: text("avatar_seed").notNull(),
    role: text("role", { enum: ["user", "moderator", "admin"] })
        .notNull()
        .default("user"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
        .notNull()
        .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
        .notNull()
        .$defaultFn(() => new Date())
        .$onUpdate(() => new Date())
});

export const profileRelations = relations(profile, ({ one }) => ({
    user: one(user, {
        fields: [profile.userId],
        references: [user.id]
    })
}));

/**
 * Per-subject daily counters (SPEC §9.2). `subject` is a user id or a hashed
 * IP, never a raw address; no inputs, state, or answers are stored.
 */
export const usageDaily = sqliteTable(
    "usage_daily",
    {
        subject: text("subject").notNull(),
        day: text("day").notNull(),
        runs: integer("runs").notNull().default(0),
        tokens: integer("tokens").notNull().default(0)
    },
    (table) => [primaryKey({ columns: [table.subject, table.day] })]
);

/**
 * A provider connection owned by one account (SPEC §9.2 and §10.5).
 *
 * Non-secret settings live in real columns; `config_json` holds the small
 * provider-specific extras (`{ accountId }`, `{ headerName }`). The credential
 * is stored as AES-256-GCM ciphertext in base64, never as plaintext. Base64
 * text keeps the row portable across D1 and the crypto module without Node's
 * Buffer, and the AAD binds each ciphertext to this row.
 */
export const connection = sqliteTable(
    "connection",
    {
        id: text("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        provider: text("provider", {
            enum: ["jev", "laya", "clef", "cloudflare", "systemone"]
        }).notNull(),
        label: text("label").notNull(),
        baseUrl: text("base_url").notNull().default(""),
        model: text("model"),
        configJson: text("config_json").notNull().default("{}"),
        authScheme: text("auth_scheme", { enum: ["bearer", "header", "none"] })
            .notNull()
            .default("bearer"),
        secretCt: text("secret_ct"),
        secretIv: text("secret_iv"),
        keyVersion: integer("key_version"),
        secretLast4: text("secret_last4"),
        status: text("status", { enum: ["unchecked", "ok", "error"] })
            .notNull()
            .default("unchecked"),
        lastCheckedAt: integer("last_checked_at", { mode: "timestamp_ms" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date()),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date())
    },
    (table) => [index("connection_user_provider_idx").on(table.userId, table.provider)]
);

/**
 * A maker's app (SPEC §9.2). `blueprint_json` is the editable draft; published
 * versions are immutable snapshots in `app_version`. The display columns are
 * denormalized from `meta` so catalog queries never parse JSON.
 *
 * `draft_revision` is optimistic concurrency: a PATCH must name the revision it
 * started from, and a mismatch means someone else saved first.
 */
export const app = sqliteTable(
    "app",
    {
        id: text("id").primaryKey(),
        ownerId: text("owner_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        slug: text("slug").notNull().unique(),
        title: text("title").notNull(),
        tagline: text("tagline").notNull().default(""),
        description: text("description"),
        icon: text("icon").notNull().default("✳️"),
        accent: text("accent", {
            enum: ["blue", "pink", "lime", "tangerine", "violet", "sky"]
        })
            .notNull()
            .default("violet"),
        tagsJson: text("tags_json").notNull().default("[]"),
        blueprintJson: text("blueprint_json").notNull(),
        draftRevision: integer("draft_revision").notNull().default(1),
        publishedVersionId: text("published_version_id"),
        visibility: text("visibility", {
            enum: ["draft", "unlisted", "public", "blocked"]
        })
            .notNull()
            .default("draft"),
        // Remix lineage points at another app/version. No FK: the source may be
        // deleted without invalidating the child draft.
        remixedFromAppId: text("remixed_from_app_id"),
        remixedFromVersionId: text("remixed_from_version_id"),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date()),
        updatedAt: integer("updated_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date())
            .$onUpdate(() => new Date()),
        publishedAt: integer("published_at", { mode: "timestamp_ms" })
    },
    (table) => [
        index("app_owner_idx").on(table.ownerId),
        index("app_visibility_published_idx").on(table.visibility, table.publishedAt),
        index("app_published_version_idx").on(table.publishedVersionId)
    ]
);

/**
 * One immutable published snapshot. `app.blueprint_json` may move on; this row
 * never does. The pair (`app_id`, `version`) is unique, and `version` is handed
 * out from the current max inside a single batch at publish time.
 */
export const appVersion = sqliteTable(
    "app_version",
    {
        id: text("id").primaryKey(),
        appId: text("app_id")
            .notNull()
            .references(() => app.id, { onDelete: "cascade" }),
        version: integer("version").notNull(),
        blueprintJson: text("blueprint_json").notNull(),
        changelog: text("changelog"),
        createdBy: text("created_by")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: integer("created_at", { mode: "timestamp_ms" })
            .notNull()
            .$defaultFn(() => new Date())
    },
    (table) => [
        uniqueIndex("app_version_app_version_idx").on(table.appId, table.version),
        index("app_version_app_idx").on(table.appId)
    ]
);

export const appRelations = relations(app, ({ one, many }) => ({
    owner: one(user, {
        fields: [app.ownerId],
        references: [user.id]
    }),
    versions: many(appVersion)
}));

export const appVersionRelations = relations(appVersion, ({ one }) => ({
    app: one(app, {
        fields: [appVersion.appId],
        references: [app.id]
    })
}));

export * from "./auth.schema";
