import { type MarketQuote, mergeQuotes } from "@apc/calc";
import type { City } from "../catalog/cities";

/** Quotes by `${marketId}|${city}|${quality}` */
export type QuoteMap = ReadonlyMap<string, MarketQuote>;

export function quoteKey(marketId: string, city: City, quality = 1): string {
    return `${marketId}|${city}|${quality}`;
}

/** One quote over several qualities of an item, see `mergeQuotes` */
export function mergedQuote(
    quotes: QuoteMap | undefined,
    marketId: string,
    city: City,
    qualities: readonly number[],
    now: number,
): MarketQuote | undefined {
    const found = qualities.flatMap((quality) => {
        const quote = quotes?.get(quoteKey(marketId, city, quality));

        return quote ? [quote] : [];
    });

    return found.length > 0 ? mergeQuotes(found, now) : undefined;
}
