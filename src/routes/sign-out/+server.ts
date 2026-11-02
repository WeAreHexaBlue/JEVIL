import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		await locals.auth.api.signOut({ headers: request.headers });
	} catch {
		// Clearing a missing session is still a successful sign-out.
	}

	redirect(303, '/');
};
