import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { type Db, MIGRATIONS_FOLDER } from "./client.ts";
import * as schema from "./schema.ts";

/** In-memory Postgres with migrations applied, for tests */
export async function createTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    return { db: db as unknown as Db, close: () => client.close() };
}
