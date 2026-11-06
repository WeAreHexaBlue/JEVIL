import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { oauthAction } from "./oauth";

const signInSocial = vi.fn(async () => ({
    url: "https://accounts.google.com/o/oauth2/v2/auth?state=test",
    redirect: true
}));

const locals = {
    auth: { api: { signInSocial } }
} as unknown as App.Locals;

const request = new Request("http://localhost:5173/sign-in");

describe("oauthAction", () => {
    it("redirects to the provider authorization URL", async () => {
        try {
            await oauthAction("google", request, locals, new URL("http://localhost:5173/sign-in"));
            throw new Error("expected a redirect");
        } catch (error) {
            expect(isRedirect(error)).toBe(true);
            if (!isRedirect(error)) throw error;
            expect(error.status).toBe(303);
            expect(error.location).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=test");
        }

        expect(signInSocial).toHaveBeenCalledWith({
            body: {
                provider: "google",
                callbackURL: "http://localhost:5173/me",
                errorCallbackURL: "http://localhost:5173/sign-in"
            },
            headers: request.headers
        });
    });

    it("returns a safe failure when the provider has no URL", async () => {
        const unavailable = {
            auth: {
                api: {
                    signInSocial: vi.fn(async () => ({ redirect: false }))
                }
            }
        } as unknown as App.Locals;

        const result = await oauthAction(
            "github",
            request,
            unavailable,
            new URL("http://localhost:5173/sign-in")
        );

        expect(result).toMatchObject({ status: 400 });
    });
});
