import { z } from "zod";
import { providerIdSchema } from "./primitives";

/**
 * Browser-local connection (SPEC §10.5). Guest connections never reach D1:
 * they live in IndexedDB, and a cloud key is sent only as an ephemeral header
 * to `/api/proxy/decide`.
 */
export const guestModeSchema = z.enum(["cloud", "local"]);

const guestConnectionFields = z.strictObject({
    id: z.string().min(1).max(64),
    version: z.literal(1),
    mode: guestModeSchema,
    provider: providerIdSchema,
    label: z.string().trim().min(1).max(60),
    baseUrl: z.string().trim().max(300),
    model: z
        .string()
        .trim()
        .max(120)
        .regex(/^[A-Za-z0-9@/._-]+$/, "That model id is not valid.")
        .optional(),
    secret: z.string().max(4096).optional(),
    headerName: z
        .string()
        .trim()
        .max(64)
        .regex(/^[A-Za-z0-9-]+$/, "That header name is not valid.")
        .optional(),
    createdAt: z.number().int().nonnegative()
});

type GuestRules = {
    mode: "cloud" | "local";
    baseUrl: string;
    secret?: string;
    headerName?: string;
};

const needsUrl = (connection: GuestRules) =>
    connection.mode !== "local" || connection.baseUrl.length > 0;
const needsKey = (connection: GuestRules) =>
    connection.mode !== "cloud" || Boolean(connection.secret);
const headerNeedsKey = (connection: GuestRules) =>
    !connection.headerName || Boolean(connection.secret);

export const guestConnectionSchema = guestConnectionFields
    .refine(needsUrl, "A local connection needs a URL")
    .refine(needsKey, "A cloud connection needs a key")
    .refine(headerNeedsKey, "A custom header needs a key");

export type GuestConnection = z.infer<typeof guestConnectionSchema>;

/** Everything the UI collects; the store fills in id, version, and time. */
export const guestDraftSchema = guestConnectionFields
    .omit({ id: true, version: true, createdAt: true })
    .refine(needsUrl, "A local connection needs a URL")
    .refine(needsKey, "A cloud connection needs a key")
    .refine(headerNeedsKey, "A custom header needs a key")
    .refine(
        (draft) => draft.mode !== "local" || draft.provider === "systemone",
        "Local endpoints use the custom provider"
    );

/**
 * Validate and normalize a draft. Returns the row to store or null when the
 * input is not usable. The key is kept as typed (trimmed), never logged.
 */
export const makeGuestConnection = (
    draft: unknown,
    { id = crypto.randomUUID(), now = Date.now() }: { id?: string; now?: number } = {}
): GuestConnection | null => {
    const parsed = guestDraftSchema.safeParse(draft);
    if (!parsed.success) return null;

    const value = parsed.data;
    const secret = value.secret?.trim();

    const result = guestConnectionSchema.safeParse({
        ...value,
        id,
        version: 1,
        createdAt: now,
        baseUrl: value.baseUrl.trim(),
        secret: secret && secret.length > 0 ? secret : undefined
    });

    return result.success ? result.data : null;
};
