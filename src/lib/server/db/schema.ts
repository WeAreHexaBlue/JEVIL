import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

/**
 * Public-facing maker profile. One row per Better Auth user, created lazily on
 * first authenticated page load.
 */
export const profile = sqliteTable('profile', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	handle: text('handle').notNull().unique(),
	displayName: text('display_name').notNull(),
	bio: text('bio'),
	avatarSeed: text('avatar_seed').notNull(),
	role: text('role', { enum: ['user', 'moderator', 'admin'] })
		.notNull()
		.default('user'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
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

export * from './auth.schema';
