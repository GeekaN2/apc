import { and, between, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { upsertOrders } from "./orders.ts";
import { type MarketOrder, type Server, serverOrderActivity, servers } from "./schema.ts";

const MINUTE = 60_000;
const WINDOW_MINUTES = 60;
const MAX_CHECK_AGE = 3 * MINUTE;
const ACTIVITY_RETENTION = 2 * WINDOW_MINUTES * MINUTE;

/** Writes an ingest batch and its minute count atomically. */
export async function storeIngestBatch(db: Db, orders: MarketOrder[]): Promise<void> {
    const first = orders[0];

    if (!first) {
        return;
    }

    const minute = new Date(Math.floor(first.updatedAt.getTime() / MINUTE) * MINUTE);

    await db.transaction(async (tx) => {
        await upsertOrders(tx, orders);
        await tx
            .insert(serverOrderActivity)
            .values({ serverId: first.serverId, minute, orders: orders.length })
            .onConflictDoUpdate({
                target: [serverOrderActivity.serverId, serverOrderActivity.minute],
                set: { orders: sql`${serverOrderActivity.orders} + excluded.orders` },
            });
    });
}

export async function recordIngestHealth(
    db: Db,
    server: Pick<Server, "id" | "natsUrl">,
    connected: boolean,
    now: Date,
): Promise<void> {
    await db
        .update(servers)
        .set({ ingestConnected: connected, ingestCheckedAt: now })
        .where(
            and(
                eq(servers.id, server.id),
                eq(servers.natsUrl, server.natsUrl),
                or(isNull(servers.ingestCheckedAt), lte(servers.ingestCheckedAt, now)),
            ),
        );
}

export async function serverActivity(db: Db, visibleServers: Server[], now: Date) {
    const currentMinute = Math.floor(now.getTime() / MINUTE) * MINUTE;
    const from = currentMinute - (WINDOW_MINUTES - 1) * MINUTE;
    const activity = new Map(
        visibleServers.map((server) => [
            server.id,
            new Array<number>(WINDOW_MINUTES).fill(0),
        ]),
    );
    const rows = await db
        .select()
        .from(serverOrderActivity)
        .where(
            and(
                inArray(serverOrderActivity.serverId, [...activity.keys()]),
                between(
                    serverOrderActivity.minute,
                    new Date(from),
                    new Date(currentMinute),
                ),
            ),
        );

    for (const { serverId, minute, orders } of rows) {
        activity.get(serverId)![Math.floor((minute.getTime() - from) / MINUTE)] = orders;
    }

    return {
        from: new Date(from).toISOString(),
        servers: visibleServers.map(({ id, ingestConnected, ingestCheckedAt }) => ({
            id,
            connected:
                ingestCheckedAt &&
                now.getTime() - ingestCheckedAt.getTime() <= MAX_CHECK_AGE
                    ? ingestConnected
                    : null,
            ordersByMinute: activity.get(id)!,
        })),
    };
}

export async function deleteOldServerActivity(db: Db, now: Date): Promise<void> {
    await db
        .delete(serverOrderActivity)
        .where(
            lt(serverOrderActivity.minute, new Date(now.getTime() - ACTIVITY_RETENTION)),
        );
}
