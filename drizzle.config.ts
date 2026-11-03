import { defineConfig } from "drizzle-kit";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_DATABASE_ID;
const token = process.env.CLOUDFLARE_D1_TOKEN;

const credentials = accountId && databaseId && token ? { accountId, databaseId, token } : undefined;

export default defineConfig({
    schema: "./src/lib/server/db/schema.ts",
    out: "./drizzle",
    dialect: "sqlite",
    verbose: true,
    strict: true,
    ...(credentials ? { driver: "d1-http" as const, dbCredentials: credentials } : {})
});
