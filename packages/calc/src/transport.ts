import type { Item } from "@apc/game-data";
import type { Catalog } from "./catalog.ts";
import { type Sale, hasPrice, saleIncome } from "./market.ts";
import { isFresh } from "./prices.ts";

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
