import { createDb } from "@apc/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not set");
}

const port = Number(process.env.PORT ?? 4000);
const hostname = process.env.HOST ?? "127.0.0.1";
const { db, close } = createDb(url);
const server = serve({ fetch: createApp(db).fetch, port, hostname }, (info) => {
    console.log(`API listening on http://${info.address}:${info.port}/api`);
});

async function shutdown() {
    server.close();
    await close();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
