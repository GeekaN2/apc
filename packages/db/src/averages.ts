import { and, eq, inArray, max, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import type { City } from "./markets.ts";
import { type AveragePrice, averagePrices } from "./schema.ts";

const BATCH_SIZE = 500;

export async function upsertAveragePrices(db: Db, rows: AveragePrice[]): Promise<void> {
    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        await db
            .insert(averagePrices)
            .values(rows.slice(start, start + BATCH_SIZE))
            .onConflictDoUpdate({
                target: [
                    averagePrices.serverId,
                    averagePrices.itemId,
                    averagePrices.city,
                ],
                set: {
                    averagePrice: sql`excluded.average_price`,
                    averageItems: sql`excluded.average_items`,
                    firstDate: sql`excluded.first_date`,
                    lastDate: sql`excluded.last_date`,
                    updatedAt: sql`excluded.updated_at`,
                },
            });
    }
}

export interface AveragesQuery {
    serverId: string;
    itemIds: string[];
    cities: City[];
}

export async function getAveragePrices(db: Db, query: AveragesQuery) {
    if (query.itemIds.length === 0 || query.cities.length === 0) {
        return [];
    }

    return db
        .select({
            itemId: averagePrices.itemId,
            city: averagePrices.city,
            averagePrice: averagePrices.averagePrice,
            averageItems: averagePrices.averageItems,
            firstDate: averagePrices.firstDate,
            lastDate: averagePrices.lastDate,
        })
        .from(averagePrices)
        .where(
            and(
                eq(averagePrices.serverId, query.serverId),
                inArray(averagePrices.itemId, query.itemIds),
                inArray(averagePrices.city, query.cities),
            ),
        );
}

/** Averages of every item in a city */
export async function cityAverages(db: Db, query: { serverId: string; city: City }) {
    return db
        .select({
            itemId: averagePrices.itemId,
            averagePrice: averagePrices.averagePrice,
            averageItems: averagePrices.averageItems,
        })
        .from(averagePrices)
        .where(
            and(
                eq(averagePrices.serverId, query.serverId),
                eq(averagePrices.city, query.city),
            ),
        );
}

/** When averages of a server were updated last */
export async function lastAveragesUpdate(
    db: Db,
    serverId: string,
): Promise<Date | undefined> {
    const [row] = await db
        .select({ updatedAt: max(averagePrices.updatedAt) })
        .from(averagePrices)
        .where(eq(averagePrices.serverId, serverId));

    return row?.updatedAt ?? undefined;
}
