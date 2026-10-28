import type { CityMarket, MarketQuote } from "@apc/calc";
import type { MarketSnapshot } from "@apc/api";
import { useQueries } from "@tanstack/react-query";
import type { City } from "../catalog/cities";
import { api } from "./client";
import { useCurrentServer } from "./servers";

const MINUTE = 60_000;

/** Columns of `/api/market` back to quotes by `${marketId}|${quality}` */
function decode(snapshot: MarketSnapshot): CityMarket {
    const at = Date.parse(snapshot.generatedAt);
    const date = (age: number) => (age < 0 ? null : new Date(at - age * MINUTE));
    const quotes = new Map<string, MarketQuote>();

    snapshot.items.forEach((itemId, i) => {
        quotes.set(`${itemId}|${snapshot.qualities[i]}`, {
            sellPriceMin: snapshot.sell[i]!,
            sellPriceMinDate: date(snapshot.sellAge[i]!),
            buyPriceMax: snapshot.buy[i]!,
            buyPriceMaxDate: date(snapshot.buyAge[i]!),
        });
    });

    return {
        city: snapshot.city,
        quotes,
        averageItems: new Map(
            snapshot.averages.items.map((itemId, i) => [
                itemId,
                snapshot.averages.averageItems[i]!,
            ]),
        ),
    };
}

/** The whole market of each city on the selected server, refreshed every minute */
export function useMarkets(cities: readonly City[]) {
    const server = useCurrentServer();

    return useQueries({
        queries: cities.map((city) => ({
            queryKey: ["market", server?.id, city],
            enabled: server !== undefined,
            staleTime: MINUTE,
            refetchInterval: MINUTE,
            queryFn: async (): Promise<CityMarket & { generatedAt: number }> => {
                const response = await api.market.$get({
                    query: { server: server!.id, city },
                });

                if (!response.ok) {
                    throw new Error(`Failed to load ${city}: ${response.status}`);
                }

                const snapshot = (await response.json()) as MarketSnapshot;

                return {
                    ...decode(snapshot),
                    generatedAt: Date.parse(snapshot.generatedAt),
                };
            },
        })),
        combine: (results) => ({
            markets: results.flatMap((result) => (result.data ? [result.data] : [])),
            isPending: results.some((result) => result.isPending),
            isFetching: results.some((result) => result.isFetching),
            error: results.find((result) => result.error)?.error ?? null,
        }),
    });
}
