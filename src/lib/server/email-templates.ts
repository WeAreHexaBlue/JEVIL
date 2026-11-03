/** Minimal HTML escaping for values interpolated into email markup. */
export const escapeHtml = (value: string): string =>
    value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[character] ?? character
    );

const layout = (heading: string, body: string): string => `<!doctype html>
<html lang="en">
	<body style="margin:0;padding:32px 16px;background:#f7f4ff;color:#171123;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
		<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3dcf2;border-radius:20px;padding:32px">
			<div style="font-weight:800;letter-spacing:-0.03em;font-size:20px;color:#5b21b6">JEVIL</div>
			<h1 style="margin:20px 0 12px;font-size:24px;line-height:1.2;letter-spacing:-0.02em">${heading}</h1>
			${body}
			<p style="margin:28px 0 0;font-size:12px;color:#6c6287">JEVIL, a HexaBlue project. If you didn't ask for this email, you can ignore it.</p>
		</div>
	</body>
</html>`;

const button = (url: string, label: string): string =>
    `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#5b21b6;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">${escapeHtml(label)}</a></p>`;

const paragraph = (text: string): string =>
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d3450">${text}</p>`;

type Recipient = { name?: string | null };

const greeting = (user: Recipient): string => escapeHtml(user.name?.trim() || "there");
const plainName = (user: Recipient): string => user.name?.trim() || "there";

export type TransactionalEmail = { subject: string; text: string; html: string };

export const verificationEmail = ({
    user,
    url
}: {
    user: Recipient;
    url: string;
}): TransactionalEmail => ({
    subject: "Confirm your email for JEVIL",
    text: `Hi ${plainName(user)},\n\nConfirm your email for JEVIL:\n${url}\n\nThe link expires in one hour. If you didn't make an account, ignore this email.`,
    html: layout(
        "Confirm your email",
        `${paragraph(`Hi ${greeting(user)},`)}${paragraph("Open the link below to confirm your email and publish apps on JEVIL.")}${button(url, "Confirm email")}${paragraph(`The link expires in one hour. If you didn't make an account, ignore this email.`)}`
    )
});

export const passwordResetEmail = ({
    user,
    url
}: {
    user: Recipient;
    url: string;
}): TransactionalEmail => ({
    subject: "Reset your JEVIL password",
    text: `Hi ${plainName(user)},\n\nSet a new password for JEVIL:\n${url}\n\nThe link expires in one hour. If you didn't ask, ignore this email.`,
    html: layout(
        "Set a new password",
        `${paragraph(`Hi ${greeting(user)},`)}${paragraph("Open the link below to choose a new password.")}${button(url, "Choose a new password")}${paragraph(`The link expires in one hour. If you didn't ask for this, ignore this email.`)}`
    )
});
