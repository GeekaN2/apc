/** Applies migrations and seeds the public servers into DATABASE_URL */
import { createDb } from "../client.ts";
import { seedServers } from "../servers.ts";

const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not set");
}

const { db, migrate, close } = createDb(url);

await migrate();
await seedServers(db);
await close();

console.log("Migrations applied, servers seeded");
