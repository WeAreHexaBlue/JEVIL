import { describe, expect, it } from 'vitest';
import { authErrorCode } from './auth-errors';

describe('authErrorCode', () => {
	it('reads a Better Auth APIError body code', () => {
		expect(authErrorCode({ status: 401, body: { code: 'INVALID_EMAIL_OR_PASSWORD' } })).toBe(
			'INVALID_EMAIL_OR_PASSWORD'
		);
	});

	it('reads a plain code property', () => {
		expect(authErrorCode({ code: 'USER_ALREADY_EXISTS' })).toBe('USER_ALREADY_EXISTS');
	});

	it('returns undefined for unknown shapes', () => {
		expect(authErrorCode(new Error('boom'))).toBeUndefined();
		expect(authErrorCode(null)).toBeUndefined();
		expect(authErrorCode('nope')).toBeUndefined();
		expect(authErrorCode({ body: { code: 42 } })).toBeUndefined();
	});
});
