import { z } from "zod";

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 24;

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Public maker handle. Lowercase, 3–24 chars, single hyphens. */
export const handleSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(HANDLE_MIN)
    .max(HANDLE_MAX)
    .regex(kebab, "Use lowercase letters, numbers, and single hyphens.");

/** App slug. Lowercase kebab-case, 3–48 chars. */
export const slugSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(48)
    .regex(kebab, "Use lowercase letters, numbers, and single hyphens.");

export const providerIdSchema = z.enum(["jev", "laya", "clef", "cloudflare", "systemone"]);

export const displayNameSchema = z.string().trim().min(1).max(60);

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const passwordSchema = z.string().min(8).max(128);

/** Turn arbitrary text into a candidate handle, or `maker` when nothing usable remains. */
export const normalizeHandle = (input: string): string => {
    const ascii = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    const slug = ascii
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, HANDLE_MAX)
        .replace(/-+$/g, "");

    return slug.length >= HANDLE_MIN ? slug : "maker";
};

/** Add a numeric suffix while keeping the handle inside the length limit. */
export const handleCandidate = (base: string, attempt: number): string => {
    const normalized = normalizeHandle(base);
    if (attempt <= 0) return normalized;

    const suffix = `-${attempt}`;
    const stem = normalized.slice(0, HANDLE_MAX - suffix.length).replace(/-+$/g, "");
    return `${stem || "maker"}${suffix}`;
};

/** True when a D1/SQLite error is a unique-constraint violation. */
export const isUniqueViolation = (error: unknown): boolean =>
    error instanceof Error && /unique constraint failed/i.test(error.message);
