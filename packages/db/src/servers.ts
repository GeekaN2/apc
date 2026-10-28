import { eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { type Server, servers } from "./schema.ts";

/** Public Albion Online Data servers */
export const AODP_SERVERS: Server[] = [
    {
        id: "west",
        name: "Americas",
        natsUrl: "nats://public:thenewalbiondata@nats.albion-online-data.com:4222",
        isPublic: true,
    },
    {
        id: "east",
        name: "Asia",
        natsUrl: "nats://public:thenewalbiondata@nats.albion-online-data.com:24222",
        isPublic: true,
    },
    {
        id: "europe",
        name: "Europe",
        natsUrl: "nats://public:thenewalbiondata@nats.albion-online-data.com:34222",
        isPublic: true,
    },
];

/** Adds the public servers that are not in the database yet */
export async function seedServers(db: Db): Promise<void> {
    await db.insert(servers).values(AODP_SERVERS).onConflictDoNothing();
}

export async function listServers(db: Db, options: { publicOnly?: boolean } = {}) {
    const query = db.select().from(servers);

    return options.publicOnly ? query.where(eq(servers.isPublic, true)) : query;
}
