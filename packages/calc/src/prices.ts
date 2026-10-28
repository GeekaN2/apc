import type { GameConstants } from "@apc/game-data";
import { type SaleKind, hasPrice, saleIncome } from "./market.ts";

/** A price this old or older is outdated */
export const PRICE_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/** Best orders of an item in a city, as Albion Online Data reports them */
export interface MarketQuote {
    sellPriceMin: number;
    sellPriceMinDate: Date | string | number;
    buyPriceMax: number;
    buyPriceMaxDate: Date | string | number;
}

export interface PickedPrice {
    price: number;
    date: Date;
    /** sellOrder for the lowest sell order, buyOrder for the highest buy order */
    kind: SaleKind;
}

export function isFresh(date: Date | string | number, now: number): boolean {
    return new Date(date).getTime() > now - PRICE_FRESHNESS_MS;
}

/**
 * Price to sell an item at: the fresh side of the market, otherwise
 * the side that brings more silver after the market fees
 */
export function pickSalePrice(
    quote: MarketQuote,
    options: {
        marketPlace: GameConstants["marketPlace"];
        now: number;
        premium?: boolean;
    },
): PickedPrice {
    const { marketPlace, now, premium = true } = options;
    const sell: PickedPrice = {
        price: quote.sellPriceMin,
        date: new Date(quote.sellPriceMinDate),
        kind: "sellOrder",
    };
    const buy: PickedPrice = {
        price: quote.buyPriceMax,
        date: new Date(quote.buyPriceMaxDate),
        kind: "buyOrder",
    };

    if (!hasPrice(buy.price)) {
        return hasPrice(sell.price) ? sell : buy;
    }

    if (!hasPrice(sell.price)) {
        return buy;
    }

    const sellFresh = isFresh(sell.date, now);
    const buyFresh = isFresh(buy.date, now);

    if (sellFresh !== buyFresh) {
        return sellFresh ? sell : buy;
    }

    return saleIncome(marketPlace, buy.price, "buyOrder", premium) >
        saleIncome(marketPlace, sell.price, "sellOrder", premium)
        ? buy
        : sell;
}
