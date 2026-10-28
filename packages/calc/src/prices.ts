import type { GameConstants } from "@apc/game-data";
import { type SaleKind, hasPrice, saleIncome } from "./market.ts";

/** A price this old or older is outdated */
export const PRICE_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/** A newer price wins over a better one when it is at least this much newer */
export const PRICE_RECENCY_MS = 5 * 60 * 1000;

type PriceDate = Date | string | number | null;

/** Best orders of an item in a city, as Albion Online Data reports them */
export interface MarketQuote {
    sellPriceMin: number;
    sellPriceMinDate: PriceDate;
    buyPriceMax: number;
    buyPriceMaxDate: PriceDate;
}

export interface PickedPrice {
    price: number;
    date: Date;
    /** sellOrder for the lowest sell order, buyOrder for the highest buy order */
    kind: SaleKind;
}

export function isFresh(date: PriceDate, now: number): boolean {
    return date !== null && new Date(date).getTime() > now - PRICE_FRESHNESS_MS;
}

interface SidePrice {
    price: number;
    date: PriceDate;
}

/** Which of two prices of one market side to keep */
function preferPrice(
    a: SidePrice,
    b: SidePrice,
    better: "lower" | "higher",
    now: number,
) {
    if (!hasPrice(a.price) || !hasPrice(b.price)) {
        return hasPrice(a.price) ? a : b;
    }

    const aFresh = isFresh(a.date, now);

    if (aFresh !== isFresh(b.date, now)) {
        return aFresh ? a : b;
    }

    const aTime = new Date(a.date ?? 0).getTime();
    const bTime = new Date(b.date ?? 0).getTime();

    if (Math.abs(aTime - bTime) >= PRICE_RECENCY_MS) {
        return aTime > bTime ? a : b;
    }

    return (better === "lower" ? a.price < b.price : a.price > b.price) ? a : b;
}

/**
 * One quote out of quotes of several qualities or sources. Each side of the market
 * is merged on its own: a fresh price beats a stale one, then a price newer by five
 * minutes, then the better one: the lowest sell order or the highest buy order.
 */
export function mergeQuotes(quotes: MarketQuote[], now: number): MarketQuote {
    let sell: SidePrice = { price: 0, date: null };
    let buy: SidePrice = { price: 0, date: null };

    for (const quote of quotes) {
        sell = preferPrice(
            sell,
            { price: quote.sellPriceMin, date: quote.sellPriceMinDate },
            "lower",
            now,
        );
        buy = preferPrice(
            buy,
            { price: quote.buyPriceMax, date: quote.buyPriceMaxDate },
            "higher",
            now,
        );
    }

    return {
        sellPriceMin: sell.price,
        sellPriceMinDate: sell.date,
        buyPriceMax: buy.price,
        buyPriceMaxDate: buy.date,
    };
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
        date: new Date(quote.sellPriceMinDate ?? 0),
        kind: "sellOrder",
    };
    const buy: PickedPrice = {
        price: quote.buyPriceMax,
        date: new Date(quote.buyPriceMaxDate ?? 0),
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
