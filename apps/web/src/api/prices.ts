import { type MarketQuote, mergeQuotes } from "@apc/calc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { City } from "../catalog/catalog";
import { api } from "./client";
import { useCurrentServer } from "./servers";

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

/** Best orders on the selected server; resources only have the normal quality */
export function usePrices(
    marketIds: readonly string[],
    cities: readonly City[],
    qualities: readonly number[] = [1],
) {
    const server = useCurrentServer();
    const sortedCities = [...new Set(cities)].sort();
    const sortedQualities = [...new Set([1, ...qualities])].sort();

    return useQuery({
        queryKey: ["prices", server?.id, marketIds, sortedCities, sortedQualities],
        enabled: server !== undefined && marketIds.length > 0,
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<QuoteMap> => {
            const response = await api.prices.$get({
                query: {
                    server: server!.id,
                    items: marketIds.join(","),
                    cities: sortedCities.join(","),
                    qualities: sortedQualities.join(","),
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load prices: ${response.status}`);
            }

            const quotes = await response.json();

            return new Map(
                quotes.map((quote) => [
                    quoteKey(quote.itemId, quote.city, quote.quality),
                    quote,
                ]),
            );
        },
    });
}

export interface Average {
    averagePrice: number;
    averageItems: number;
}

/** 30 day averages of items in a city on the selected server, by item id */
export function useAverages(marketIds: readonly string[], city: City) {
    const server = useCurrentServer();

    return useQuery({
        queryKey: ["averages", server?.id, marketIds, city],
        enabled: server !== undefined && marketIds.length > 0,
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<ReadonlyMap<string, Average>> => {
            const response = await api.averages.$get({
                query: { server: server!.id, items: marketIds.join(","), cities: city },
            });

            if (!response.ok) {
                throw new Error(`Failed to load averages: ${response.status}`);
            }

            const averages = await response.json();

            return new Map(averages.map((average) => [average.itemId, average]));
        },
    });
}
