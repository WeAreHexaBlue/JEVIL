import { describe, expect, it } from "vitest";
import {
    createKeyRing,
    CryptoConfigError,
    DecryptionError,
    decryptSecret,
    encryptSecret,
    type AadParts,
    type EncryptedSecret,
    type KeyRing
} from "./crypto";

const key = (): string => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
};

const parts: AadParts = {
    userId: "user_1",
    connectionId: "conn_1",
    provider: "laya"
};

const ring = (): Promise<KeyRing> => createKeyRing({ ENCRYPTION_KEY: key() });

const bytesOf = (value: string): Uint8Array =>
    Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const base64Of = (bytes: Uint8Array): string => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
};

const decryptError = async (
    secret: EncryptedSecret,
    aad: AadParts,
    keys: KeyRing
): Promise<unknown> => {
    try {
        await decryptSecret(secret, aad, keys);
    } catch (error) {
        return error;
    }
    return null;
};

describe("encryptSecret / decryptSecret", () => {
    it("round-trips a credential", async () => {
        const keys = await ring();
        const secret = await encryptSecret("test-credential-value", parts, keys);

        expect(secret.version).toBe(1);
        expect(secret.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
        expect(secret.ciphertext).not.toContain("test-credential-value");
        await expect(decryptSecret(secret, parts, keys)).resolves.toBe("test-credential-value");
    });

    it("uses a fresh IV for every write", async () => {
        const keys = await ring();
        const first = await encryptSecret("same-value", parts, keys);
        const second = await encryptSecret("same-value", parts, keys);

        expect(first.iv).not.toBe(second.iv);
        expect(first.ciphertext).not.toBe(second.ciphertext);
        await expect(decryptSecret(first, parts, keys)).resolves.toBe("same-value");
        await expect(decryptSecret(second, parts, keys)).resolves.toBe("same-value");
    });

    it("fails when any AAD part changes", async () => {
        const keys = await ring();
        const secret = await encryptSecret("test-credential-value", parts, keys);

        const variants: AadParts[] = [
            { ...parts, userId: "user_2" },
            { ...parts, connectionId: "conn_2" },
            { ...parts, provider: "clef" }
        ];

        for (const variant of variants) {
            expect(await decryptError(secret, variant, keys)).toBeInstanceOf(DecryptionError);
        }
    });

    it("fails on a tampered ciphertext or IV", async () => {
        const keys = await ring();
        const secret = await encryptSecret("test-credential-value", parts, keys);

        const ciphertext = bytesOf(secret.ciphertext);
        ciphertext[0] ^= 1;
        const tamperedCiphertext = { ...secret, ciphertext: base64Of(ciphertext) };

        const iv = bytesOf(secret.iv);
        iv[0] ^= 1;
        const tamperedIv = { ...secret, iv: base64Of(iv) };

        expect(await decryptError(tamperedCiphertext, parts, keys)).toBeInstanceOf(DecryptionError);
        expect(await decryptError(tamperedIv, parts, keys)).toBeInstanceOf(DecryptionError);
    });

    it("fails on an unknown key version and malformed payloads", async () => {
        const keys = await ring();
        const secret = await encryptSecret("test-credential-value", parts, keys);

        expect(await decryptError({ ...secret, version: 9 }, parts, keys)).toBeInstanceOf(
            DecryptionError
        );
        expect(await decryptError({ ...secret, iv: "not base64!" }, parts, keys)).toBeInstanceOf(
            DecryptionError
        );
        expect(
            await decryptError({ ...secret, iv: base64Of(new Uint8Array(4)) }, parts, keys)
        ).toBeInstanceOf(DecryptionError);
    });

    it("never puts the credential in an error message", async () => {
        const keys = await ring();
        const secret = await encryptSecret("test-credential-value", parts, keys);
        const error = await decryptError(secret, { ...parts, userId: "other" }, keys);

        expect(error).toBeInstanceOf(DecryptionError);
        expect((error as Error).message).not.toContain("test-credential-value");
        expect((error as Error).message).not.toContain(secret.ciphertext);
    });
});

describe("createKeyRing", () => {
    it("reads a single ENCRYPTION_KEY as version 1", async () => {
        const keys = await ring();

        expect(keys.newestVersion).toBe(1);
        expect([...keys.keys.keys()]).toEqual([1]);
    });

    it("reads a rotation map, writes with the newest version, and keeps old versions readable", async () => {
        const first = key();
        const oldRing = await createKeyRing({ ENCRYPTION_KEY: first });
        const secret = await encryptSecret("old-credential", parts, oldRing);

        const second = key();
        const rotated = await createKeyRing({
            ENCRYPTION_KEYS: JSON.stringify({ "1": first, "2": second })
        });

        expect(rotated.newestVersion).toBe(2);
        await expect(decryptSecret(secret, parts, rotated)).resolves.toBe("old-credential");

        const fresh = await encryptSecret("new-credential", parts, rotated);
        expect(fresh.version).toBe(2);
        await expect(decryptSecret(fresh, parts, rotated)).resolves.toBe("new-credential");
        await expect(decryptSecret(fresh, parts, oldRing)).rejects.toBeInstanceOf(DecryptionError);
    });

    it("prefers ENCRYPTION_KEYS over ENCRYPTION_KEY", async () => {
        const keys = await createKeyRing({
            ENCRYPTION_KEY: key(),
            ENCRYPTION_KEYS: JSON.stringify({ "4": key() })
        });

        expect(keys.newestVersion).toBe(4);
    });

    it("rejects missing, malformed, and wrong-length keys", async () => {
        const short = btoa("\x00".repeat(16));
        const attempts = [
            () => createKeyRing({}),
            () => createKeyRing({ ENCRYPTION_KEY: "not base64!" }),
            () => createKeyRing({ ENCRYPTION_KEY: short }),
            () => createKeyRing({ ENCRYPTION_KEYS: "not json" }),
            () => createKeyRing({ ENCRYPTION_KEYS: JSON.stringify({ zero: key() }) }),
            () => createKeyRing({ ENCRYPTION_KEYS: JSON.stringify({ "0": key() }) }),
            () => createKeyRing({ ENCRYPTION_KEYS: JSON.stringify({ "1": 42 }) })
        ];

        for (const attempt of attempts) {
            await expect(attempt()).rejects.toBeInstanceOf(CryptoConfigError);
        }
    });

    it("does not echo key material in a configuration error", async () => {
        const value = "this-is-not-a-valid-key";
        const error = await createKeyRing({ ENCRYPTION_KEY: value }).catch((cause) => cause);

        expect(error).toBeInstanceOf(CryptoConfigError);
        expect((error as Error).message).not.toContain(value);
    });
});
