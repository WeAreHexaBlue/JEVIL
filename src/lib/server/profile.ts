import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { profile } from './db/schema';
import { handleCandidate, isUniqueViolation, normalizeHandle } from '#lib/schema/primitives';

export type Profile = typeof profile.$inferSelect;

type AuthUser = {
	id: string;
	name?: string | null;
	email: string;
};

/**
 * Return the maker profile for a user, creating it on first use.
 *
 * The handle is derived from the display name and disambiguated with a numeric
 * suffix. Concurrent requests are safe: a unique-constraint failure falls back
 * to reading the row the other request created.
 */
export const ensureProfile = async (d1: D1Database, user: AuthUser): Promise<Profile> => {
	const db = getDb(d1);

	const existing = await db.select().from(profile).where(eq(profile.userId, user.id)).get();
	if (existing) return existing;

	const base = normalizeHandle(user.name || user.email.split('@')[0] || 'maker');
	const displayName = (user.name ?? '').trim().slice(0, 60) || base;

	for (let attempt = 0; attempt < 25; attempt += 1) {
		const handle = handleCandidate(base, attempt);

		try {
			const rows = await db
				.insert(profile)
				.values({ userId: user.id, handle, displayName, avatarSeed: user.id })
				.returning();

			const created = rows[0];
			if (created) return created;
		} catch (error) {
			if (!isUniqueViolation(error)) throw error;

			const raced = await db.select().from(profile).where(eq(profile.userId, user.id)).get();
			if (raced) return raced;
		}
	}

	throw new Error('Could not allocate a handle');
};
