/**
 * Provider credential encryption (SPEC §10.6).
 *
 * AES-256-GCM with a random IV per write. The additional authenticated data
 * binds a ciphertext to one user, connection, provider, and key version, so a
 * row copied to another connection (or decrypted under the wrong key) fails
 * instead of returning a secret.
 *
 * Key material only ever lives in memory here. Errors never echo a key, a
 * ciphertext, or a provider payload.
 */

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const TAG_BITS = 128;

/** A credential as stored in D1. Both blobs are base64. */
export interface EncryptedSecret {
    /** Key version used for this ciphertext. */
    version: number;
    iv: string;
    ciphertext: string;
}

/** The row identity bound into the ciphertext. */
export interface AadParts {
    userId: string;
    connectionId: string;
    provider: string;
}

export interface KeyRing {
    readonly keys: ReadonlyMap<number, CryptoKey>;
    /** Version used for new writes. */
    readonly newestVersion: number;
}

/** Bad key configuration. The message never includes the key. */
export class CryptoConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CryptoConfigError";
    }
}

/** Authentication failure: tampered payload, wrong AAD, or wrong key. */
export class DecryptionError extends Error {
    constructor() {
        super("Could not decrypt the stored credential");
        this.name = "DecryptionError";
    }
}

type Bytes = Uint8Array<ArrayBuffer>;

const encodeBase64 = (bytes: Bytes): string => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
};

const decodeBase64 = (value: string): Bytes => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

const decodeKey = (value: string): Bytes => {
    let bytes: Bytes;
    try {
        bytes = decodeBase64(value.trim());
    } catch {
        throw new CryptoConfigError("Encryption keys must be base64-encoded 32-byte values");
    }

    if (bytes.length !== KEY_BYTES) {
        throw new CryptoConfigError("Encryption keys must be base64-encoded 32-byte values");
    }

    return bytes;
};

const importKey = (bytes: Bytes): Promise<CryptoKey> =>
    crypto.subtle.importKey("raw", bytes, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const readVersionedKeys = (json: string): Array<[number, string]> => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new CryptoConfigError(
            "ENCRYPTION_KEYS must be a JSON object of version to base64 key"
        );
    }

    if (!isRecord(parsed)) {
        throw new CryptoConfigError(
            "ENCRYPTION_KEYS must be a JSON object of version to base64 key"
        );
    }

    const entries: Array<[number, string]> = [];
    for (const [version, value] of Object.entries(parsed)) {
        if (!/^[1-9]\d*$/.test(version) || typeof value !== "string") {
            throw new CryptoConfigError(
                "ENCRYPTION_KEYS must be a JSON object of version to base64 key"
            );
        }
        entries.push([Number(version), value]);
    }

    return entries;
};

/**
 * Build the key ring from environment values.
 *
 * - `ENCRYPTION_KEYS` (JSON `version → base64 key`) wins when present; new
 *   writes use the highest version and older versions stay readable.
 * - Otherwise `ENCRYPTION_KEY` becomes version 1.
 */
export const createKeyRing = async ({
    ENCRYPTION_KEY,
    ENCRYPTION_KEYS
}: {
    ENCRYPTION_KEY?: string;
    ENCRYPTION_KEYS?: string;
}): Promise<KeyRing> => {
    const entries = ENCRYPTION_KEYS?.trim()
        ? readVersionedKeys(ENCRYPTION_KEYS)
        : ENCRYPTION_KEY?.trim()
          ? ([[1, ENCRYPTION_KEY]] as Array<[number, string]>)
          : [];

    if (entries.length === 0) {
        throw new CryptoConfigError(
            "No encryption key configured; set ENCRYPTION_KEY or ENCRYPTION_KEYS"
        );
    }

    const keys = new Map<number, CryptoKey>();
    for (const [version, value] of entries) {
        if (keys.has(version)) {
            throw new CryptoConfigError(`Duplicate encryption key version ${version}`);
        }
        keys.set(version, await importKey(decodeKey(value)));
    }

    return {
        keys,
        newestVersion: Math.max(...keys.keys())
    };
};

const additionalData = (parts: AadParts, version: number): Bytes =>
    new TextEncoder().encode(`${parts.userId}:${parts.connectionId}:${parts.provider}:${version}`);

/**
 * Encrypt a credential under the newest key version, bound to `parts`.
 * A fresh 12-byte IV is generated for every call.
 */
export const encryptSecret = async (
    plaintext: string,
    parts: AadParts,
    ring: KeyRing
): Promise<EncryptedSecret> => {
    const key = ring.keys.get(ring.newestVersion);
    if (!key) {
        throw new CryptoConfigError("No encryption key is available for writing");
    }

    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: ALGORITHM,
            iv,
            additionalData: additionalData(parts, ring.newestVersion),
            tagLength: TAG_BITS
        },
        key,
        new TextEncoder().encode(plaintext)
    );

    return {
        version: ring.newestVersion,
        iv: encodeBase64(iv),
        ciphertext: encodeBase64(new Uint8Array(ciphertext))
    };
};

/**
 * Decrypt a stored credential under the version recorded with it. Any failure
 * is a `DecryptionError` so callers cannot distinguish tampering from a wrong
 * key, and no detail about the payload escapes.
 */
export const decryptSecret = async (
    secret: EncryptedSecret,
    parts: AadParts,
    ring: KeyRing
): Promise<string> => {
    const key = ring.keys.get(secret.version);
    if (!key) throw new DecryptionError();

    let iv: Bytes;
    let ciphertext: Bytes;

    try {
        iv = decodeBase64(secret.iv);
        ciphertext = decodeBase64(secret.ciphertext);
    } catch {
        throw new DecryptionError();
    }

    if (iv.length !== IV_BYTES || ciphertext.length < TAG_BITS / 8) {
        throw new DecryptionError();
    }

    let plaintext: ArrayBuffer;
    try {
        plaintext = await crypto.subtle.decrypt(
            {
                name: ALGORITHM,
                iv,
                additionalData: additionalData(parts, secret.version),
                tagLength: TAG_BITS
            },
            key,
            ciphertext
        );
    } catch {
        throw new DecryptionError();
    }

    return new TextDecoder().decode(plaintext);
};
