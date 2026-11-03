import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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

export * from "./auth.schema";
