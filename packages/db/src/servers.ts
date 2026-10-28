import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { user } from "./authSchema.ts";
import { averagePrices, marketOrders, serverAccess, servers } from "./schema.ts";

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

/** Private server as its owner edits it */
export interface PrivateServerInput {
    name: string;
    description?: string | null;
    natsUrl: string;
    /** Nicknames of users who may see the server besides its owner */
    access: string[];
}

export interface PrivateServer {
    id: string;
    name: string;
    description: string | null;
    natsUrl: string;
    ownerId: string | null;
    access: string[];
}

/** Users by nickname, case-insensitive like better-auth usernames */
async function usersByNickname(db: Db, nicknames: readonly string[]) {
    const names = [
        ...new Set(nicknames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
    ];

    if (names.length === 0) {
        return { ids: [], unknown: [] };
    }

    const found = await db
        .select({ id: user.id, username: user.username })
        .from(user)
        .where(inArray(user.username, names));
    const known = new Set(found.map((u) => u.username));

    return { ids: found.map((u) => u.id), unknown: names.filter((n) => !known.has(n)) };
}

/** Private servers a user owns, or every private server for admins */
export async function listPrivateServers(
    db: Db,
    options: { ownerId?: string },
): Promise<PrivateServer[]> {
    const rows = await db
        .select()
        .from(servers)
        .where(
            options.ownerId
                ? and(eq(servers.isPublic, false), eq(servers.ownerId, options.ownerId))
                : eq(servers.isPublic, false),
        );
    const access = rows.length
        ? await db
              .select({
                  serverId: serverAccess.serverId,
                  nickname: sql<string>`coalesce(${user.displayUsername}, ${user.username})`,
              })
              .from(serverAccess)
              .innerJoin(user, eq(user.id, serverAccess.userId))
              .where(
                  inArray(
                      serverAccess.serverId,
                      rows.map((r) => r.id),
                  ),
              )
        : [];

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        natsUrl: row.natsUrl,
        ownerId: row.ownerId,
        access: access.filter((a) => a.serverId === row.id).map((a) => a.nickname),
    }));
}

export async function getServer(db: Db, id: string) {
    const [server] = await db.select().from(servers).where(eq(servers.id, id));

    return server;
}

/** Replaces who may see a server; returns nicknames without a user */
async function setAccess(db: Db, serverId: string, nicknames: readonly string[]) {
    const { ids, unknown } = await usersByNickname(db, nicknames);

    await db.delete(serverAccess).where(eq(serverAccess.serverId, serverId));

    if (ids.length > 0) {
        await db.insert(serverAccess).values(ids.map((userId) => ({ serverId, userId })));
    }

    return unknown;
}

/** Adds a private server; returns nicknames of the access list without a user */
export async function createPrivateServer(
    db: Db,
    id: string,
    ownerId: string,
    input: PrivateServerInput,
): Promise<{ unknown: string[] }> {
    return db.transaction(async (tx) => {
        await tx.insert(servers).values({
            id,
            name: input.name,
            description: input.description ?? null,
            natsUrl: input.natsUrl,
            isPublic: false,
            ownerId,
        });

        return { unknown: await setAccess(tx as unknown as Db, id, input.access) };
    });
}

export async function updatePrivateServer(
    db: Db,
    id: string,
    input: PrivateServerInput,
): Promise<{ unknown: string[] }> {
    return db.transaction(async (tx) => {
        await tx
            .update(servers)
            .set({
                name: input.name,
                description: input.description ?? null,
                natsUrl: input.natsUrl,
            })
            .where(eq(servers.id, id));

        return { unknown: await setAccess(tx as unknown as Db, id, input.access) };
    });
}

/** Deletes a private server with its orders and averages */
export async function deletePrivateServer(db: Db, id: string): Promise<void> {
    await db.transaction(async (tx) => {
        await tx.delete(marketOrders).where(eq(marketOrders.serverId, id));
        await tx.delete(averagePrices).where(eq(averagePrices.serverId, id));
        await tx.delete(servers).where(eq(servers.id, id));
    });
}
