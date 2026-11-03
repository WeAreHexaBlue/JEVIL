import { createAuth } from "./auth";

/**
 * Schema-generation entry point for the Better Auth CLI.
 *
 * This instance is never used at runtime. `bun run auth:schema` imports this
 * module, reads the exported `auth`, and writes the Drizzle schema.
 */
export const auth = createAuth(null!);
