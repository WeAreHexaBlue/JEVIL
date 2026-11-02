import { defineEnvVars } from '@sveltejs/kit/env';

const required = (name: string) => (value: string | undefined) => {
	if (!value) throw new Error(`${name} is required`);
	return value;
};

const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	ORIGIN: {
		description: 'The canonical app origin, e.g. `http://localhost:5173` or `https://jevil.app`.',
		schema: required('ORIGIN')
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign sessions. Use at least 32 characters of high-entropy randomness.',
		schema: required('BETTER_AUTH_SECRET')
	},
	GOOGLE_CLIENT_ID: {
		description: 'Google OAuth client ID. Leave empty to disable Google sign-in.',
		schema: optional
	},
	GOOGLE_CLIENT_SECRET: {
		description: 'Google OAuth client secret. Leave empty to disable Google sign-in.',
		schema: optional
	},
	GITHUB_CLIENT_ID: {
		description: 'GitHub OAuth client ID. Leave empty to disable GitHub sign-in.',
		schema: optional
	},
	GITHUB_CLIENT_SECRET: {
		description: 'GitHub OAuth client secret. Leave empty to disable GitHub sign-in.',
		schema: optional
	},
	ENCRYPTION_KEY: {
		description:
			'Base64-encoded 32-byte key used to encrypt provider credentials at rest. Required once connections ship.',
		schema: optional
	},
	RESEND_API_KEY: {
		description: 'Resend API key for verification and password-reset email.',
		schema: optional
	},
	EMAIL_FROM: {
		description: 'Sender address for transactional email, e.g. `JEVIL <hello@jevil.app>`.',
		schema: optional
	}
});
