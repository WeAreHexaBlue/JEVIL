import { z } from "zod";
import { providerIdSchema, type ProviderId } from "./primitives";

export const connectionAuthSchemeSchema = z.enum(["bearer", "header", "none"]);

export const connectionStatusSchema = z.enum(["unchecked", "ok", "error"]);

const labelSchema = z.string().trim().min(1).max(60);
const baseUrlSchema = z.string().trim().max(300);
const modelSchema = z
    .string()
    .trim()
    .max(120)
    .regex(/^[A-Za-z0-9@/._-]+$/, "Use letters, numbers, and @ / . _ - only.")
    .refine((value) => !value.includes(".."), "That model id is not valid.");

/** Provider credential as sent by the client. Never echoed back. */
const secretSchema = z.string().trim().min(1).max(4096);

/** Non-secret provider config (SPEC §10.2). Secrets never go here. */
export const connectionConfigSchema = z.strictObject({
    accountId: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, underscores, and hyphens only.")
        .optional(),
    headerName: z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, and hyphens only.")
        .optional()
});

export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;

const optionalModel = modelSchema.optional();

export const connectionCreateSchema = z.strictObject({
    provider: providerIdSchema,
    label: labelSchema,
    baseUrl: baseUrlSchema.default(""),
    model: optionalModel,
    secret: secretSchema.optional(),
    config: connectionConfigSchema.default({}),
    authScheme: connectionAuthSchemeSchema.optional()
});

export type ConnectionCreateInput = z.infer<typeof connectionCreateSchema>;

/**
 * PATCH body. The provider is immutable: changing it would invalidate the AAD
 * that binds the stored credential to this row.
 */
export const connectionPatchSchema = z
    .strictObject({
        label: labelSchema.optional(),
        baseUrl: baseUrlSchema.optional(),
        model: optionalModel,
        secret: secretSchema.optional(),
        config: connectionConfigSchema.optional(),
        authScheme: connectionAuthSchemeSchema.optional()
    })
    .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type ConnectionPatchInput = z.infer<typeof connectionPatchSchema>;

/** What the client is allowed to see. There is no secret field on purpose. */
export interface ConnectionView {
    id: string;
    provider: ProviderId;
    label: string;
    baseUrl: string;
    model: string | null;
    config: ConnectionConfig;
    authScheme: z.infer<typeof connectionAuthSchemeSchema>;
    status: z.infer<typeof connectionStatusSchema>;
    lastCheckedAt: number | null;
    secretLast4: string | null;
    createdAt: number;
    updatedAt: number;
}
