/**
 * Log redaction.
 *
 * Nothing that leaves this module may contain a credential, a header value, or
 * user content. Call sites hand over whatever they have; the helpers strip the
 * dangerous parts before a line is written.
 */

export const REDACTED = "[redacted]";

/** Field names that never reach a log line, matched case-insensitively. */
const SENSITIVE_FIELDS = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "x-jevil-key",
    "x-jevil-base-url",
    "x-jevil-model",
    "x-jevil-provider",
    "password",
    "newpassword",
    "token",
    "secret",
    "apikey",
    "api_key",
    "key",
    // User content: never log it, even when a caller passes a request body.
    "body",
    "content",
    "email",
    "input",
    "name",
    "output",
    "prompt",
    "state",
    "text"
]);

/** Headers that are safe to keep: they carry no credentials or content. */
const SAFE_HEADERS = new Set(["accept", "content-length", "content-type", "user-agent"]);

const MAX_DEPTH = 6;
const MAX_ENTRIES = 40;
const MAX_STRING = 300;

/** Provider keys, bearer tokens, and long opaque blobs. */
const TOKEN_PATTERNS = [
    /\b(?:sk|pk|jv|laya)_[A-Za-z0-9_-]{6,}\b/g,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{6,}/gi,
    /\b[A-Za-z0-9_-]{40,}\b/g
];

const scrub = (value: string): string => {
    let result = value;
    for (const pattern of TOKEN_PATTERNS) result = result.replace(pattern, REDACTED);
    return result.length > MAX_STRING ? `${result.slice(0, MAX_STRING)}…` : result;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep-copy a value with sensitive fields and long strings stripped.
 * Depth, array length, and object size are capped so a hostile value can't
 * turn a log line into a payload.
 */
export const redact = (value: unknown, depth = 0): unknown => {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return scrub(value);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return value.toString();
    if (typeof value === "function") return "[function]";
    if (depth >= MAX_DEPTH) return "[truncated]";

    if (Array.isArray(value)) {
        return value.slice(0, MAX_ENTRIES).map((item) => redact(item, depth + 1));
    }

    if (value instanceof Error) {
        return { name: value.name, message: scrub(value.message) };
    }

    if (isPlainObject(value)) {
        const entries = Object.entries(value).slice(0, MAX_ENTRIES);
        const result: Record<string, unknown> = {};

        for (const [key, item] of entries) {
            result[key] = SENSITIVE_FIELDS.has(key.toLowerCase())
                ? REDACTED
                : redact(item, depth + 1);
        }

        return result;
    }

    return "[unserializable]";
};

/**
 * Keep header names and safe values, replace everything else. Prefer logging no
 * headers at all; this exists so a stray call can't leak a session cookie.
 */
export const redactHeaders = (
    headers: Headers | Record<string, string>
): Record<string, string> => {
    const entries = headers instanceof Headers ? [...headers.entries()] : Object.entries(headers);
    const result: Record<string, string> = {};

    for (const [name, value] of entries) {
        const key = name.toLowerCase();
        result[key] = SAFE_HEADERS.has(key) ? scrub(value) : REDACTED;
    }

    return result;
};

/**
 * Turn a thrown value into something safe to log: a name plus a scrubbed,
 * truncated message. Provider payloads must be mapped to error codes before
 * they reach this helper.
 */
export const safeError = (error: unknown): { errorName: string; errorMessage: string } => {
    if (error instanceof Error) {
        return { errorName: error.name, errorMessage: scrub(error.message) };
    }

    if (isPlainObject(error) && typeof error.code === "string") {
        return { errorName: "Error", errorMessage: scrub(error.code) };
    }

    return { errorName: "Error", errorMessage: "Unknown error" };
};
