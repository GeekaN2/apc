import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { type City, MARKETS, cityOfLocation } from "./markets.ts";
import { getAveragePrices } from "./averages.ts";
import { type MarketOrder, averagePrices, marketOrders } from "./schema.ts";

const BATCH_SIZE = 500;

/** Inserts new orders and updates price, amount and expiry of known ones */
export async function upsertOrders(db: Db, orders: MarketOrder[]): Promise<void> {
    for (let start = 0; start < orders.length; start += BATCH_SIZE) {
        await db
            .insert(marketOrders)
            .values(orders.slice(start, start + BATCH_SIZE))
            .onConflictDoUpdate({
                target: [marketOrders.serverId, marketOrders.orderId],
                set: {
                    unitPriceSilver: sql`excluded.unit_price_silver`,
                    amount: sql`excluded.amount`,
                    expiresAt: sql`excluded.expires_at`,
                    updatedAt: sql`excluded.updated_at`,
                },
            });
    }
}

/** Deletes expired orders, returns how many */
export async function deleteExpiredOrders(db: Db, now: Date): Promise<number> {
    const deleted = await db
        .delete(marketOrders)
        .where(lte(marketOrders.expiresAt, now))
        .returning({ orderId: marketOrders.orderId });

    return deleted.length;
}

export interface PriceQuery {
    serverId: string;
    itemIds: string[];
    cities: City[];
    qualities: number[];
    now: Date;
}

/** Best orders of an item in a city, the shape of Albion Online Data prices */
export interface Quote {
    itemId: string;
    city: City;
    quality: number;
    /** Lowest sell order, 0 when there is none */
    sellPriceMin: number;
    sellPriceMinDate: Date | null;
    /** Highest buy order, 0 when there is none */
    buyPriceMax: number;
    buyPriceMaxDate: Date | null;
}

/**
 * Sell orders priced above the average this many times are trolling and ignored,
 * as in the old calculator. Buy orders are kept: a high buy order pays real silver.
 */
export const OVERPRICED_FACTOR = 5;

/** Lowest sell and highest buy order per item, city and quality among live orders */
export async function bestPrices(db: Db, query: PriceQuery): Promise<Quote[]> {
    const locationIds = query.cities.flatMap((city) => MARKETS[city]);

    if (
        query.itemIds.length === 0 ||
        locationIds.length === 0 ||
        query.qualities.length === 0
    ) {
        return [];
    }

    const orders = await db
        .select({
            itemId: marketOrders.itemId,
            locationId: marketOrders.locationId,
            qualityLevel: marketOrders.qualityLevel,
            unitPriceSilver: marketOrders.unitPriceSilver,
            auctionType: marketOrders.auctionType,
            updatedAt: marketOrders.updatedAt,
        })
        .from(marketOrders)
        .where(
            and(
                eq(marketOrders.serverId, query.serverId),
                inArray(marketOrders.itemId, query.itemIds),
                inArray(marketOrders.locationId, locationIds),
                inArray(marketOrders.qualityLevel, query.qualities),
                gt(marketOrders.expiresAt, query.now),
            ),
        );

    const averages = new Map(
        (await getAveragePrices(db, query)).map((a) => [
            `${a.itemId}|${a.city}`,
            a.averagePrice,
        ]),
    );

    return aggregateQuotes(orders, averages);
}

type OrderRow = Pick<
    typeof marketOrders.$inferSelect,
    | "itemId"
    | "locationId"
    | "qualityLevel"
    | "unitPriceSilver"
    | "auctionType"
    | "updatedAt"
>;

/**
 * Lowest sell and highest buy order per item, city and quality. Sell orders priced
 * above the 30 day average (by `${itemId}|${city}`) too many times are trolling.
 */
function aggregateQuotes(
    orders: readonly OrderRow[],
    averages: ReadonlyMap<string, number>,
): Quote[] {
    const quotes = new Map<string, Quote>();

    for (const order of orders) {
        const city = cityOfLocation(order.locationId)!;
        const average = averages.get(`${order.itemId}|${city}`);

        if (
            order.auctionType === "offer" &&
            average &&
            order.unitPriceSilver > average * OVERPRICED_FACTOR
        ) {
            continue;
        }

        const key = `${order.itemId}|${city}|${order.qualityLevel}`;
        const quote = quotes.get(key) ?? {
            itemId: order.itemId,
            city,
            quality: order.qualityLevel,
            sellPriceMin: 0,
            sellPriceMinDate: null,
            buyPriceMax: 0,
            buyPriceMaxDate: null,
        };
        const price = order.unitPriceSilver;

        if (order.auctionType === "offer") {
            if (quote.sellPriceMin === 0 || price < quote.sellPriceMin) {
                quote.sellPriceMin = price;
                quote.sellPriceMinDate = order.updatedAt;
            }
        } else if (price > quote.buyPriceMax) {
            quote.buyPriceMax = price;
            quote.buyPriceMaxDate = order.updatedAt;
        }

        quotes.set(key, quote);
    }

    return [...quotes.values()];
}

/** Best orders of every item in a city: the whole market of one city at once */
export async function cityPrices(
    db: Db,
    query: { serverId: string; city: City; now: Date },
): Promise<Quote[]> {
    const orders = await db
        .select({
            itemId: marketOrders.itemId,
            locationId: marketOrders.locationId,
            qualityLevel: marketOrders.qualityLevel,
            unitPriceSilver: marketOrders.unitPriceSilver,
            auctionType: marketOrders.auctionType,
            updatedAt: marketOrders.updatedAt,
        })
        .from(marketOrders)
        .where(
            and(
                eq(marketOrders.serverId, query.serverId),
                inArray(marketOrders.locationId, [...MARKETS[query.city]]),
                gt(marketOrders.expiresAt, query.now),
            ),
        );
    const averages = await db
        .select({
            itemId: averagePrices.itemId,
            averagePrice: averagePrices.averagePrice,
        })
        .from(averagePrices)
        .where(
            and(
                eq(averagePrices.serverId, query.serverId),
                eq(averagePrices.city, query.city),
            ),
        );

    return aggregateQuotes(
        orders,
        new Map(averages.map((a) => [`${a.itemId}|${query.city}`, a.averagePrice])),
    );
}
