import type { Item } from "@apc/game-data";
import type { Catalog } from "./catalog.ts";
import { type Sale, hasPrice, saleIncome } from "./market.ts";
import { type MarketQuote, type PickedPrice, isFresh, pickSalePrice } from "./prices.ts";

export interface TransportInput {
    catalog: Catalog;
    item: Item;
    /** Lowest sell order at the source city, bought instantly */
    buyPrice?: number;
    buyDate?: Date | string | number;
    /** Sale at the destination city */
    sale: Sale;
    saleDate?: Date | string | number;
    /** Items sold per day at the destination */
    averageItems?: number;
    now: number;
    premium?: boolean;
}

/** Per one item */
export interface TransportResult {
    income?: number;
    profit?: number;
    profitPercentage?: number;
    /** Profit times items sold per day */
    profitVolume?: number;
    /** Profit per kilogram of mount load, from the item weight */
    profitPerWeight?: number;
    /** How many of the two prices are less than a day old */
    freshPrices: number;
}

export function transport(input: TransportInput): TransportResult {
    const { catalog, item, buyPrice, sale, now, premium = true } = input;
    const freshPrices =
        Number(input.buyDate !== undefined && isFresh(input.buyDate, now)) +
        Number(input.saleDate !== undefined && isFresh(input.saleDate, now));

    if (!hasPrice(buyPrice) || !hasPrice(sale.price)) {
        return { freshPrices };
    }

    const income = saleIncome(
        catalog.constants.marketPlace,
        sale.price,
        sale.kind,
        premium,
    );
    const profit = income - buyPrice;

    return {
        income,
        profit,
        profitPercentage: (profit / buyPrice) * 100,
        profitVolume:
            input.averageItems === undefined ? undefined : profit * input.averageItems,
        profitPerWeight: item.weight ? profit / item.weight : undefined,
        freshPrices,
    };
}

export type TransportSort =
    "freshPrices" | "profitPercentage" | "profit" | "profitVolume" | "profitPerWeight";

/** Comparator for routes, best first; keys are applied in order, missing values go last */
export function compareTransports(sorts: TransportSort[]) {
    return (a: TransportResult, b: TransportResult): number => {
        for (const sort of sorts) {
            const valueA = a.profit === undefined ? -Infinity : (a[sort] ?? -Infinity);
            const valueB = b.profit === undefined ? -Infinity : (b[sort] ?? -Infinity);

            if (valueA !== valueB) {
                return valueB > valueA ? 1 : -1;
            }
        }

        return 0;
    };
}

/** Best orders of a city by `${marketId}|${quality}` and items sold per day by market id */
export interface CityMarket {
    city: string;
    quotes: ReadonlyMap<string, MarketQuote>;
    averageItems: ReadonlyMap<string, number>;
}

export interface Route {
    marketId: string;
    quality: number;
    item: Item;
    from: { city: string; price: number; date: Date };
    to: { city: string; sale: PickedPrice };
    /** Items sold per day at the destination */
    averageItems?: number;
    result: TransportResult;
}

/**
 * Profitable routes: for every item and quality the cheapest city to buy it in and
 * the best other city to sell it in. One source and one destination compare two
 * cities; several find the best pair among them.
 */
export function findRoutes(options: {
    catalog: Catalog;
    from: readonly CityMarket[];
    to: readonly CityMarket[];
    now: number;
    premium: boolean;
}): Route[] {
    const { catalog, now, premium } = options;
    const { marketPlace } = catalog.constants;
    const keys = new Set(options.from.flatMap((market) => [...market.quotes.keys()]));
    const routes: Route[] = [];

    for (const key of keys) {
        const [marketId, quality] = key.split("|") as [string, string];
        const item = catalog.item(marketId.split("@")[0]!);

        if (!item) {
            continue;
        }

        let from: Route["from"] | undefined;

        for (const market of options.from) {
            const quote = market.quotes.get(key);

            if (
                quote &&
                hasPrice(quote.sellPriceMin) &&
                (!from || quote.sellPriceMin < from.price)
            ) {
                from = {
                    city: market.city,
                    price: quote.sellPriceMin,
                    date: new Date(quote.sellPriceMinDate ?? 0),
                };
            }
        }

        if (!from) {
            continue;
        }

        let best: { market: CityMarket; sale: PickedPrice; income: number } | undefined;

        for (const market of options.to) {
            const quote = market.quotes.get(key);

            if (!quote || market.city === from.city) {
                continue;
            }

            const sale = pickSalePrice(quote, { marketPlace, now, premium });

            if (!hasPrice(sale.price)) {
                continue;
            }

            const income = saleIncome(marketPlace, sale.price, sale.kind, premium);

            if (!best || income > best.income) {
                best = { market, sale, income };
            }
        }

        if (!best) {
            continue;
        }

        const averageItems = best.market.averageItems.get(marketId);
        const result = transport({
            catalog,
            item,
            buyPrice: from.price,
            buyDate: from.date,
            sale: best.sale,
            saleDate: best.sale.date,
            averageItems,
            now,
            premium,
        });

        routes.push({
            marketId,
            quality: Number(quality),
            item,
            from,
            to: { city: best.market.city, sale: best.sale },
            averageItems,
            result,
        });
    }

    return routes;
}
