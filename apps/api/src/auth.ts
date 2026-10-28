import * as schema from "@apc/db";
import type { Db } from "@apc/db";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { authPlugins } from "./authPlugins.ts";

export interface AuthOptions {
    /** Public URL of the API, e.g. http://127.0.0.1:4000 */
    baseURL: string;
    secret: string;
    /** Frontend origins allowed to send credentials */
    trustedOrigins?: string[];
    discord?: { clientId: string; clientSecret: string };
}

/**
 * Accounts migrated from the old calculator keep their bcrypt hashes;
 * new and changed passwords use better-auth's scrypt
 */
export async function verifyAnyPassword({
    hash,
    password,
}: {
    hash: string;
    password: string;
}) {
    if (/^\$2[aby]\$/.test(hash)) {
        return bcrypt.compare(password, hash);
    }

    return verifyPassword({ hash, password });
}

/**
 * Discord sign-in for new users; nickname and password sign-in only for users
 * migrated from the old calculator, who can link Discord later
 */
export function createAuth(db: Db, options: AuthOptions) {
    const { discord } = options;

    return betterAuth({
        baseURL: options.baseURL,
        secret: options.secret,
        basePath: "/api/auth",
        trustedOrigins: options.trustedOrigins,
        database: drizzleAdapter(db, { provider: "pg", schema }),
        emailAndPassword: {
            enabled: true,
            disableSignUp: true,
            password: { hash: hashPassword, verify: verifyAnyPassword },
        },
        socialProviders: discord && {
            discord: {
                ...discord,
                // Phone-only Discord accounts have no email
                mapProfileToUser: (profile) => ({
                    email: profile.email ?? `${profile.id}@discord.invalid`,
                }),
            },
        },
        account: {
            accountLinking: {
                enabled: true,
                // Migrated users have placeholder emails
                allowDifferentEmails: true,
                trustedProviders: ["discord"],
            },
        },
        plugins: authPlugins(),
        telemetry: { enabled: false },
    });
}

export type Auth = ReturnType<typeof createAuth>;
