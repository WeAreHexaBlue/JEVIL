import { describe, expect, it } from 'vitest';
import {
	HANDLE_MAX,
	emailSchema,
	handleCandidate,
	handleSchema,
	isUniqueViolation,
	normalizeHandle,
	providerIdSchema,
	slugSchema
} from './primitives';

describe('handleSchema', () => {
	it('accepts lowercase kebab-case handles', () => {
		expect(handleSchema.parse('ada-lovelace')).toBe('ada-lovelace');
		expect(handleSchema.parse('maker')).toBe('maker');
		expect(handleSchema.parse('a1b2c3')).toBe('a1b2c3');
	});

	it('rejects leading, trailing, and repeated hyphens', () => {
		expect(handleSchema.safeParse('-ada').success).toBe(false);
		expect(handleSchema.safeParse('ada-').success).toBe(false);
		expect(handleSchema.safeParse('ada--lovelace').success).toBe(false);
	});

	it('rejects handles outside the length bounds', () => {
		expect(handleSchema.safeParse('ab').success).toBe(false);
		expect(handleSchema.safeParse('a'.repeat(HANDLE_MAX + 1)).success).toBe(false);
	});
});

describe('slugSchema', () => {
	it('accepts app slugs', () => {
		expect(slugSchema.parse('palette-oracle')).toBe('palette-oracle');
	});

	it('rejects spaces and punctuation', () => {
		expect(slugSchema.safeParse('palette oracle').success).toBe(false);
		expect(slugSchema.safeParse('palette_oracle').success).toBe(false);
	});
});

describe('normalizeHandle', () => {
	it('slugs names', () => {
		expect(normalizeHandle('Ada Lovelace')).toBe('ada-lovelace');
		expect(normalizeHandle('  Grace   Hopper  ')).toBe('grace-hopper');
	});

	it('strips accents', () => {
		expect(normalizeHandle('José')).toBe('jose');
	});

	it('falls back when nothing usable remains', () => {
		expect(normalizeHandle('!!!')).toBe('maker');
		expect(normalizeHandle('ab')).toBe('maker');
	});

	it('caps the length', () => {
		const handle = normalizeHandle('a'.repeat(80));
		expect(handle).toHaveLength(HANDLE_MAX);
		expect(handleSchema.safeParse(handle).success).toBe(true);
	});
});

describe('handleCandidate', () => {
	it('returns the base on the first attempt', () => {
		expect(handleCandidate('Ada Lovelace', 0)).toBe('ada-lovelace');
	});

	it('adds a numeric suffix that keeps the handle valid', () => {
		expect(handleCandidate('ada', 2)).toBe('ada-2');
	});

	it('never exceeds the length limit', () => {
		const candidate = handleCandidate('a'.repeat(40), 123);
		expect(candidate.length).toBeLessThanOrEqual(HANDLE_MAX);
		expect(handleSchema.safeParse(candidate).success).toBe(true);
	});
});

describe('emailSchema', () => {
	it('trims and lowercases', () => {
		expect(emailSchema.parse('  Ada@Example.COM ')).toBe('ada@example.com');
	});

	it('rejects malformed addresses', () => {
		expect(emailSchema.safeParse('not-an-email').success).toBe(false);
	});
});

describe('providerIdSchema', () => {
	it('accepts the five providers', () => {
		for (const provider of ['jev', 'laya', 'clef', 'cloudflare', 'systemone']) {
			expect(providerIdSchema.parse(provider)).toBe(provider);
		}
	});

	it('rejects unknown providers', () => {
		expect(providerIdSchema.safeParse('openai').success).toBe(false);
	});
});

describe('isUniqueViolation', () => {
	it('matches D1 unique-constraint errors', () => {
		expect(isUniqueViolation(new Error('D1_ERROR: UNIQUE constraint failed: profile.handle'))).toBe(
			true
		);
	});

	it('ignores unrelated errors', () => {
		expect(isUniqueViolation(new Error('network down'))).toBe(false);
		expect(isUniqueViolation('nope')).toBe(false);
	});
});
