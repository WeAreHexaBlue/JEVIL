import { describe, expect, it } from "vitest";
import { escapeHtml, passwordResetEmail, verificationEmail } from "./email-templates";

const url = "https://jevil.app/api/auth/verify-email?token=abc123&callbackURL=%2Fverify";

describe("escapeHtml", () => {
    it("escapes every character that can break out of markup", () => {
        expect(escapeHtml(`<b>&"'</b>`)).toBe("&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;");
    });

    it("leaves plain text alone", () => {
        expect(escapeHtml("Flamey")).toBe("Flamey");
    });
});

describe("verificationEmail", () => {
    it("greets the user by name and includes the confirmation link", () => {
        const mail = verificationEmail({ user: { name: "Flamey" }, url });

        expect(mail.subject).toBe("Confirm your email for JEVIL");
        expect(mail.text).toContain("Hi Flamey,");
        expect(mail.text).toContain(url);
        expect(mail.html).toContain("Hi Flamey,");
        expect(mail.html).toContain(escapeHtml(url));
    });

    it("falls back to a neutral greeting when the name is empty", () => {
        const mail = verificationEmail({ user: { name: "  " }, url });

        expect(mail.text).toContain("Hi there,");
    });

    it("escapes the display name so it cannot inject markup", () => {
        const mail = verificationEmail({ user: { name: "<img src=x onerror=alert(1)>" }, url });

        expect(mail.html).not.toContain("<img");
        expect(mail.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(mail.text).toContain("<img src=x onerror=alert(1)>");
    });
});

describe("passwordResetEmail", () => {
    it("includes the reset link in both bodies", () => {
        const mail = passwordResetEmail({ user: { name: "Flamey" }, url });

        expect(mail.subject).toBe("Reset your JEVIL password");
        expect(mail.text).toContain(url);
        expect(mail.html).toContain(escapeHtml(url));
        expect(mail.html).toContain("Choose a new password");
    });
});
