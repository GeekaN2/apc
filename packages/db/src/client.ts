import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema.ts";

/** Drizzle database over any Postgres driver: node-postgres in services, PGlite in tests */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_FOLDER = path.join(import.meta.dirname, "../migrations");

export function createDb(connectionString: string) {
    const pool = new pg.Pool({ connectionString });
    const db = drizzle(pool, { schema });

    return {
        db: db as unknown as Db,
        close: () => pool.end(),
        migrate: () => migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    };
}
