import { describe, expect, it } from "vitest";
import { pickSalePrice } from "../src/prices.ts";
import {
    type TransportResult,
    type TransportSort,
    compareTransports,
    transport,
} from "../src/transport.ts";
import { fakePrice, getItem, loadCatalog } from "./catalog.ts";
import {
    type LegacyQuote,
    type LegacyRoute,
    type LegacySort,
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
