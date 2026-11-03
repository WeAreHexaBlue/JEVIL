import { env } from "cloudflare:workers";
import { passwordResetEmail, verificationEmail } from "./email-templates";

type Mail = {
    to: string;
    subject: string;
    text: string;
    html: string;
    /** Dev-only hint printed instead of the body, so inboxes stay out of logs. */
    devHint?: string;
};

const FROM_FALLBACK = "JEVIL <hello@jevil.app>";

/**
 * Send transactional email through Resend.
 *
 * In development, or when `RESEND_API_KEY` is unset outside production, the
 * message is not sent and only its subject plus `devHint` are printed. Never
 * log recipients, bodies, or tokens in production.
 */
export const sendMail = async ({ to, subject, text, html, devHint }: Mail): Promise<void> => {
    const apiKey = env.RESEND_API_KEY;

    if (!apiKey) {
        if (String(env.ENVIRONMENT) === "production") {
            throw new Error("RESEND_API_KEY is not configured");
        }
        console.info("[email:dev] %s%s", subject, devHint ? ` — ${devHint}` : "");
        return;
    }

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            from: env.EMAIL_FROM || FROM_FALLBACK,
            to,
            subject,
            text,
            html
        }),
        signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
        // Never echo Resend's payload: it can contain the recipient address.
        throw new Error(`Resend responded with ${response.status}`);
    }
};

export const sendVerificationEmail = async ({
    user,
    url
}: {
    user: { name?: string | null; email: string };
    url: string;
}): Promise<void> => {
    await sendMail({ to: user.email, ...verificationEmail({ user, url }), devHint: url });
};

export const sendPasswordResetEmail = async ({
    user,
    url
}: {
    user: { name?: string | null; email: string };
    url: string;
}): Promise<void> => {
    await sendMail({ to: user.email, ...passwordResetEmail({ user, url }), devHint: url });
};
