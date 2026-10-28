import { eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { serverAccess, servers } from "./schema.ts";

/** Public Albion Online Data servers */
export const AODP_SERVERS: (typeof servers.$inferInsert)[] = [
    {
        id: "west",
        name: "Americas",
        natsUrl: "nats://public:thenewalbiondata@nats.albion-online-data.com:4222",
        apiUrl: "https://west.albion-online-data.com",
        isPublic: true,
    },
    {
        id: "east",
        name: "Asia",
        natsUrl: "nats://public:thenewalbiondata@nats.albion-online-data.com:24222",
        apiUrl: "https://east.albion-online-data.com",
        isPublic: true,
    },
    {
        id: "europe",
        name: "Europe",
        natsUrl: "nats://public:thenewalbiondata@nats.albion-online-data.com:34222",
        apiUrl: "https://europe.albion-online-data.com",
        isPublic: true,
    },
];

/** Adds the public servers or updates their names and addresses */
export async function seedServers(db: Db): Promise<void> {
    await db
        .insert(servers)
        .values(AODP_SERVERS)
        .onConflictDoUpdate({
            target: servers.id,
            set: {
                name: sql`excluded.name`,
                natsUrl: sql`excluded.nats_url`,
                apiUrl: sql`excluded.api_url`,
            },
        });
}

export async function listServers(db: Db, options: { publicOnly?: boolean } = {}) {
    const query = db.select().from(servers);

    return options.publicOnly ? query.where(eq(servers.isPublic, true)) : query;
}

/** Public servers plus private ones the user owns or was given access to */
export async function listVisibleServers(db: Db, userId?: string) {
    const visible = userId
        ? or(
              eq(servers.isPublic, true),
              eq(servers.ownerId, userId),
              inArray(
                  servers.id,
                  db
                      .select({ id: serverAccess.serverId })
                      .from(serverAccess)
                      .where(eq(serverAccess.userId, userId)),
              ),
          )
        : eq(servers.isPublic, true);

    return db.select().from(servers).where(visible);
}
