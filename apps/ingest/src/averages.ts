import { type AveragePrice, CITIES } from "@apc/db";
import { type Item, marketIds } from "@apc/game-data";
import { z } from "zod";

const DAY = 24 * 60 * 60 * 1000;

/** Averages cover the last 30 days, like in the old worker */
export const AVERAGE_DAYS = 30;

/** Qualities mixed into the averages, like in the old worker */
export const AVERAGE_QUALITIES = [1, 2, 3];

/** Item ids per request, keeping the URL short */
export const MAX_IDS_LENGTH = 3000;

const chartsResponse = z.array(
    z.object({
        location: z.string(),
        item_id: z.string(),
        quality: z.number(),
        data: z.object({
            timestamps: z.array(z.string()),
            prices_avg: z.array(z.number()),
            item_count: z.array(z.number()),
        }),
    }),
);

/** Market ids of items players can trade */
export function tradableMarketIds(items: Item[]): string[] {
    return items
        .filter(
            (item) =>
                item.tradable !== false &&
                item.showInMarketplace !== false &&
                item.hideFromPlayerOnContext !== "all",
        )
        .flatMap(marketIds);
}

/** Splits ids into batches whose comma separated list fits into `maxLength` */
export function idBatches(ids: string[], maxLength = MAX_IDS_LENGTH): string[][] {
    const batches: string[][] = [];
    let batch: string[] = [];
    let length = 0;

    for (const id of ids) {
        if (batch.length > 0 && length + id.length + 1 > maxLength) {
            batches.push(batch);
            batch = [];
            length = 0;
        }

        batch.push(id);
        length += id.length + 1;
    }

    if (batch.length > 0) {
        batches.push(batch);
    }

    return batches;
}

/** The charts API takes dates as M-D-YYYY */
function chartsDate(date: Date): string {
    return `${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCFullYear()}`;
}

/** Albion Online Data daily price history of items in every city */
export function chartsUrl(apiUrl: string, itemIds: string[], now: Date): string {
    const params = new URLSearchParams({
        date: chartsDate(new Date(now.getTime() - AVERAGE_DAYS * DAY)),
        end_date: chartsDate(now),
        locations: CITIES.join(","),
        qualities: AVERAGE_QUALITIES.join(","),
        "time-scale": "24",
    });

    return `${apiUrl}/api/v2/stats/charts/${itemIds.join(",")}.json?${params}`;
}

/** Timestamps of the charts API are UTC without a zone */
function chartsTimestamp(timestamp: string): Date {
    return new Date(/Z$/.test(timestamp) ? timestamp : `${timestamp}Z`);
}

/**
 * Average price weighted by items sold and items sold per day with sales,
 * per item and city over all qualities
 */
export function aggregateCharts(
    serverId: string,
    json: unknown,
    now: Date,
): AveragePrice[] {
    const sums = new Map<
        string,
        { itemId: string; city: string; cost: number; items: number; days: Set<string> }
    >();

    for (const chart of chartsResponse.parse(json)) {
        const key = `${chart.item_id}|${chart.location}`;
        const sum = sums.get(key) ?? {
            itemId: chart.item_id,
            city: chart.location,
            cost: 0,
            items: 0,
            days: new Set<string>(),
        };
        const { timestamps, prices_avg: prices, item_count: counts } = chart.data;

        for (const [index, timestamp] of timestamps.entries()) {
            sum.cost += (prices[index] ?? 0) * (counts[index] ?? 0);
            sum.items += counts[index] ?? 0;
            sum.days.add(timestamp);
        }

        sums.set(key, sum);
    }

    return [...sums.values()]
        .filter((sum) => sum.items > 0)
        .map((sum) => {
            const days = [...sum.days].sort();

            return {
                serverId,
                itemId: sum.itemId,
                city: sum.city,
                averagePrice: sum.cost / sum.items,
                averageItems: sum.items / sum.days.size,
                firstDate: chartsTimestamp(days[0]!),
                lastDate: chartsTimestamp(days[days.length - 1]!),
                updatedAt: now,
            };
        });
}
