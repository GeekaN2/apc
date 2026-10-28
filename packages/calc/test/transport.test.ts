import { describe, expect, it } from "vitest";
import { mergeQuotes, pickSalePrice } from "../src/prices.ts";
import {
    type TransportResult,
    type TransportSort,
    compareTransports,
    findRoutes,
    transport,
} from "../src/transport.ts";
import { fakePrice, getItem, loadCatalog } from "./catalog.ts";
import {
    type LegacyQuote,
    type LegacyRoute,
    type LegacySort,
    legacyMergeQualities,
    legacyNormalizedPrice,
    legacySortRoutes,
} from "./legacy/transportations.ts";

const catalog = loadCatalog();
const { marketPlace } = catalog.constants;
const NOW = Date.UTC(2026, 9, 28, 12);
const HOUR = 60 * 60 * 1000;
/** Keeps generated dates off the exact 24 hour boundary */
const OFFSET = 17 * 60 * 1000;

const ITEMS = catalog.items
    .filter((item) => item.kind === "weapon" && item.tier >= 4)
    .slice(0, 300)
    .map((item) => item.uniqueName);

function quote(itemId: string, city: string): LegacyQuote {
    return {
        itemId,
        sellPriceMin: fakePrice(itemId, `${city}:sell`),
        sellPriceMinDate:
            NOW - (fakePrice(itemId, `${city}:sellDate`) % 48) * HOUR - OFFSET,
        buyPriceMax: fakePrice(itemId, `${city}:buy`),
        buyPriceMaxDate:
            NOW - (fakePrice(itemId, `${city}:buyDate`) % 48) * HOUR - OFFSET,
        averageItems: fakePrice(itemId, `${city}:average`) % 30,
    };
}

const ROUTES: LegacyRoute[] = ITEMS.map((itemId) => ({
    from: quote(itemId, "Martlock"),
    to: quote(itemId, "Caerleon"),
}));

function newRoute(route: LegacyRoute): TransportResult & { itemId: string } {
    return {
        itemId: route.from.itemId,
        ...transport({
            catalog,
            item: getItem(catalog, route.from.itemId),
            buyPrice: route.from.sellPriceMin,
            buyDate: route.from.sellPriceMinDate,
            sale: { price: route.to.sellPriceMin, kind: "sellOrder" },
            saleDate: route.to.sellPriceMinDate,
            averageItems: route.to.averageItems,
            now: NOW,
        }),
    };
}

const SORTS: [LegacySort[], TransportSort[]][] = [
    [
        ["BY_LAST_TIME_CHECKED", "BY_PERCENTAGE_PROFIT"],
        ["freshPrices", "profitPercentage"],
    ],
    [["BY_PERCENTAGE_PROFIT"], ["profitPercentage"]],
    [["BY_PROFIT"], ["profit"]],
    [
        ["BY_LAST_TIME_CHECKED", "BY_PROFIT_VOLUME"],
        ["freshPrices", "profitVolume"],
    ],
];

describe("transport", () => {
    it.each(SORTS)("sorts routes like the old %j", (legacySorts, sorts) => {
        const legacy = legacySortRoutes(ROUTES, legacySorts, NOW);
        const routes = ROUTES.map(newRoute).sort(compareTransports(sorts));

        expect(routes.map((r) => r.itemId)).toEqual(legacy.map((r) => r.itemId));

        for (const [index, route] of routes.entries()) {
            const old = legacy[index]!;

            expect(route.profit, route.itemId).toBeCloseTo(old.profit, 9);
            expect(route.profitPercentage, route.itemId).toBeCloseTo(
                old.percentageProfit,
                9,
            );
            expect(route.profitVolume, route.itemId).toBeCloseTo(old.profitVolume, 9);
            expect(route.freshPrices, route.itemId).toBe(old.freshness);
        }
    });

    it("gives profit per kilogram of mount load", () => {
        const item = getItem(catalog, "T4_MAIN_SWORD");
        const result = transport({
            catalog,
            item,
            buyPrice: 1_000,
            sale: { price: 2_000, kind: "sellOrder" },
            now: NOW,
        });

        expect(result.profit).toBeCloseTo(2_000 * 0.935 - 1_000, 9);
        expect(result.profitPerWeight).toBeCloseTo(result.profit! / item.weight!, 9);
    });

    it("puts routes without a destination price last", () => {
        // The old route counted a missing destination price as zero income
        const route = newRoute({
            from: quote("T4_MAIN_SWORD", "Martlock"),
            to: { ...quote("T4_MAIN_SWORD", "Caerleon"), sellPriceMin: 0 },
        });

        expect(route.profit).toBeUndefined();
        expect(
            [route, newRoute(ROUTES[0]!)].sort(compareTransports(["profit"]))[1]?.itemId,
        ).toBe("T4_MAIN_SWORD");
    });
});

describe("pickSalePrice", () => {
    /** Buy/sell ratios where the old 3% era multipliers and today's fees disagree */
    const oldThreshold = 0.955 / 0.97;
    const newThreshold = (1 - 0.04 - 0.025) / (1 - 0.04);

    it("picks the same side as the old normalizedPriceAndDate, except between the fee thresholds", () => {
        let disagreements = 0;

        for (const itemId of ITEMS) {
            for (const city of ["Martlock", "Caerleon", "Lymhurst"]) {
                const q = quote(itemId, city);
                const old = legacyNormalizedPrice(q, NOW);
                const picked = pickSalePrice(q, { marketPlace, now: NOW });

                if (picked.kind !== old.kind) {
                    const ratio = q.buyPriceMax / q.sellPriceMin;

                    disagreements++;
                    expect(ratio, itemId).toBeGreaterThan(newThreshold);
                    expect(ratio, itemId).toBeLessThanOrEqual(oldThreshold);
                } else {
                    expect(picked.price, itemId).toBe(old.price);
                }
            }
        }

        expect(disagreements).toBeLessThan(ITEMS.length * 3 * 0.05);
    });

    it("prefers the fresh side of the market", () => {
        const q = {
            sellPriceMin: 100,
            sellPriceMinDate: NOW - 2 * 24 * HOUR,
            buyPriceMax: 50,
            buyPriceMaxDate: NOW - HOUR,
        };

        expect(pickSalePrice(q, { marketPlace, now: NOW })).toMatchObject({
            price: 50,
            kind: "buyOrder",
        });
    });

    it("falls back to the only side with a price", () => {
        const q = {
            sellPriceMin: 0,
            sellPriceMinDate: 0,
            buyPriceMax: 70,
            buyPriceMaxDate: 0,
        };

        expect(pickSalePrice(q, { marketPlace, now: NOW }).kind).toBe("buyOrder");
    });
});

describe("mergeQuotes", () => {
    const MINUTE = 60 * 1000;

    /** Sell-only quality records of an item, some close in time, some a day apart */
    function qualities(itemId: string): LegacyQuote[] {
        return [1, 2, 3].map((quality) => {
            const minutes = fakePrice(itemId, `q${quality}:minutes`) % 12;
            const days = fakePrice(itemId, `q${quality}:days`) % 3 === 0 ? 30 * HOUR : 0;

            return {
                itemId,
                sellPriceMin: fakePrice(itemId, `q${quality}:sell`),
                sellPriceMinDate: NOW - HOUR - days - minutes * MINUTE,
                buyPriceMax: 0,
                buyPriceMaxDate: 0,
                averageItems: 0,
            };
        });
    }

    it("merges sell orders of qualities like the old transportations worker", () => {
        for (const itemId of ITEMS) {
            const records = qualities(itemId);
            const legacy = legacyMergeQualities(records, NOW);
            const merged = mergeQuotes(records, NOW);

            expect(merged.sellPriceMin, itemId).toBe(legacy.normalizedPrice);
            expect(merged.sellPriceMinDate, itemId).toBe(legacy.date);
        }
    });

    it("keeps the highest buy order, which the old worker treated like a sell order", () => {
        const merged = mergeQuotes(
            [
                {
                    sellPriceMin: 0,
                    sellPriceMinDate: null,
                    buyPriceMax: 900,
                    buyPriceMaxDate: NOW - HOUR,
                },
                {
                    sellPriceMin: 0,
                    sellPriceMinDate: null,
                    buyPriceMax: 950,
                    buyPriceMaxDate: NOW - HOUR - MINUTE,
                },
            ],
            NOW,
        );

        expect(merged).toMatchObject({
            buyPriceMax: 950,
            sellPriceMin: 0,
            sellPriceMinDate: null,
        });
    });

    it("prefers a fresh or a clearly newer price over a better one", () => {
        const stale = {
            sellPriceMin: 100,
            sellPriceMinDate: NOW - 30 * HOUR,
            buyPriceMax: 0,
            buyPriceMaxDate: null,
        };
        const fresh = {
            sellPriceMin: 500,
            sellPriceMinDate: NOW - HOUR,
            buyPriceMax: 0,
            buyPriceMaxDate: null,
        };
        const newer = {
            sellPriceMin: 700,
            sellPriceMinDate: NOW - HOUR + 10 * MINUTE,
            buyPriceMax: 0,
            buyPriceMaxDate: null,
        };

        expect(mergeQuotes([stale, fresh], NOW).sellPriceMin).toBe(500);
        expect(mergeQuotes([fresh, newer], NOW).sellPriceMin).toBe(700);
        expect(mergeQuotes([], NOW)).toEqual({
            sellPriceMin: 0,
            sellPriceMinDate: null,
            buyPriceMax: 0,
            buyPriceMaxDate: null,
        });
    });
});

describe("findRoutes", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const fresh = new Date(now - 60_000).toISOString();
    const quote = (sell: number, buy = 0) => ({
        sellPriceMin: sell,
        sellPriceMinDate: sell ? fresh : null,
        buyPriceMax: buy,
        buyPriceMaxDate: buy ? fresh : null,
    });
    const market = (city: string, quotes: Record<string, ReturnType<typeof quote>>) => ({
        city,
        quotes: new Map(Object.entries(quotes)),
        averageItems: new Map([["T4_BAG", 25]]),
    });
    const markets = [
        market("Martlock", { "T4_BAG|1": quote(1_000), "T4_BAG|2": quote(5_000) }),
        market("Lymhurst", { "T4_BAG|1": quote(900), "T4_BAG|2": quote(4_000) }),
        market("Caerleon", { "T4_BAG|1": quote(2_000, 1_500), "T4_BAG|3": quote(9_000) }),
    ];

    it("buys in the cheapest city and sells in the best other one, quality by quality", () => {
        const routes = findRoutes({
            catalog,
            from: markets,
            to: markets,
            now,
            premium: true,
        });
        const q1 = routes.find((r) => r.quality === 1)!;
        const q2 = routes.find((r) => r.quality === 2)!;

        expect(q1.from).toMatchObject({ city: "Lymhurst", price: 900 });
        expect(q1.to.city).toBe("Caerleon");
        expect(q1.result.profit).toBeCloseTo(2_000 * 0.935 - 900, 6);
        expect(q1.averageItems).toBe(25);
        // Quality 2 is sold where it is listed, never as quality 3
        expect(q2.from.city).toBe("Lymhurst");
        expect(q2.to.city).toBe("Martlock");
        expect(routes.some((r) => r.quality === 3)).toBe(false);
    });

    it("compares two cities", () => {
        const routes = findRoutes({
            catalog,
            from: [markets[0]!],
            to: [markets[2]!],
            now,
            premium: true,
        });

        expect(routes.map((r) => [r.from.city, r.to.city, r.quality])).toEqual([
            ["Martlock", "Caerleon", 1],
        ]);
    });
});
