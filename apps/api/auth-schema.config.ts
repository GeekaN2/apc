/**
 * Config for generating the auth tables of packages/db:
 * pnpm dlx auth@1.7.14 generate --config auth-schema.config.ts --adapter drizzle
 *   --dialect postgresql --output ../../packages/db/src/authSchema.ts
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authPlugins } from "./src/authPlugins.ts";

export const auth = betterAuth({
    database: drizzleAdapter({}, { provider: "pg" }),
    emailAndPassword: { enabled: true },
    plugins: authPlugins(),
});
