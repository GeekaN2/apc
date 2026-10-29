import { createDb } from "@apc/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createAuth } from "./auth.ts";

function required(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is not set`);
    }

    return value;
}

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.HOST ?? "127.0.0.1";
const { db, close } = createDb(required("DATABASE_URL"));
const trustedOrigins = process.env.WEB_ORIGINS?.split(",").filter(Boolean);
const discord =
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
        ? {
              clientId: process.env.DISCORD_CLIENT_ID,
              clientSecret: process.env.DISCORD_CLIENT_SECRET,
          }
        : undefined;

const discordRoles =
    process.env.DISCORD_GUILD_ID && process.env.DISCORD_SUPPORTER_ROLE_IDS
        ? {
              guildId: process.env.DISCORD_GUILD_ID,
              supporterRoleIds: process.env.DISCORD_SUPPORTER_ROLE_IDS.split(",")
                  .map((id) => id.trim())
                  .filter(Boolean),
          }
        : undefined;

const auth = createAuth(db, {
    baseURL: process.env.BETTER_AUTH_URL ?? `http://${hostname}:${port}`,
    secret: required("BETTER_AUTH_SECRET"),
    trustedOrigins,
    discord,
    discordRoles,
});

if (!discord) {
    console.log("DISCORD_CLIENT_ID is not set, Discord sign-in is disabled");
}

const app = createApp(db, { auth, trustedOrigins });
const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
    console.log(`API listening on http://${info.address}:${info.port}/api`);
});

async function shutdown() {
    server.close();
    await close();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
