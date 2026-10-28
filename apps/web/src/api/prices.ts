import type { MarketQuote } from "@apc/calc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { City } from "../catalog/catalog";
import { api } from "./client";
import { useCurrentServer } from "./servers";

/** Quotes by `${marketId}|${city}` */
export type QuoteMap = ReadonlyMap<string, MarketQuote>;

export function quoteKey(marketId: string, city: City): string {
    return `${marketId}|${city}`;
}

/** Best orders of normal quality items on the selected server */
export function usePrices(marketIds: readonly string[], cities: readonly City[]) {
    const server = useCurrentServer();
    const sortedCities = [...new Set(cities)].sort();

    return useQuery({
        queryKey: ["prices", server?.id, marketIds, sortedCities],
        enabled: server !== undefined && marketIds.length > 0,
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<QuoteMap> => {
            const response = await api.prices.$get({
                query: {
                    server: server!.id,
                    items: marketIds.join(","),
                    cities: sortedCities.join(","),
                    qualities: "1",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to load prices: ${response.status}`);
            }

            const quotes = await response.json();

            return new Map(
                quotes.map((quote) => [quoteKey(quote.itemId, quote.city), quote]),
            );
        },
    });
}
