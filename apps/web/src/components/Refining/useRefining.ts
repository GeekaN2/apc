import {
    type Catalog,
    type PickedPrice,
    type RefiningRow,
    hasPrice,
    pickSalePrice,
    refining,
    refiningMarketIds,
} from "@apc/calc";
import { useMemo } from "react";
import { type QuoteMap, quoteKey, usePrices } from "../../api/prices";
import {
    type CraftingCity,
    clusterIdOf,
    useResourceCatalog,
} from "../../catalog/catalog";
import { useRefiningStore } from "../../store/refining";

/** A price used in a calculation and how old it is */
export interface UsedPrice {
    price: number;
    date: Date;
}

export interface RefiningCell extends RefiningRow {
    sale?: PickedPrice;
    /** Buy prices of the recipe resources by market id */
    buyPrices: ReadonlyMap<string, UsedPrice>;
}

/** Refined resources of the tier below are bought in their own city */
function isRefined(catalog: Catalog, marketId: string): boolean {
    return catalog.item(marketId.split("@")[0]!)?.shopSubcategory1 === "refinedresources";
}

/** Lowest sell order: resources are bought instantly */
function buyPrice(quotes: QuoteMap | undefined, marketId: string, city: CraftingCity) {
    const quote = quotes?.get(quoteKey(marketId, city));

    return quote && hasPrice(quote.sellPriceMin)
        ? { price: quote.sellPriceMin, date: new Date(quote.sellPriceMinDate ?? 0) }
        : undefined;
}

export function useRefining() {
    const settings = useRefiningStore();
    const { data: catalog, isPending: isCatalogPending } = useResourceCatalog();
    const marketIds = useMemo(
        () => (catalog ? refiningMarketIds(catalog, settings.resource) : []),
        [catalog, settings.resource],
    );
    const { cities } = settings;
    const prices = usePrices(marketIds, [
        cities.buyRaw,
        cities.buyMaterials,
        cities.sell,
    ]);
    const quotes = prices.data;
    /** Prices are as old as of their loading, not of each render */
    const now = prices.dataUpdatedAt;

    const cells = useMemo((): RefiningCell[] => {
        if (!catalog) {
            return [];
        }

        const { marketPlace } = catalog.constants;
        const buyCity = (marketId: string) =>
            isRefined(catalog, marketId) ? cities.buyMaterials : cities.buyRaw;
        const saleOf = (marketId: string) => {
            const quote = quotes?.get(quoteKey(marketId, cities.sell));

            return quote
                ? pickSalePrice(quote, { marketPlace, now, premium: settings.premium })
                : undefined;
        };

        return refining({
            catalog,
            resource: settings.resource,
            clusterId: clusterIdOf(catalog, cities.refine),
            useFocus: settings.useFocus,
            returnRate:
                settings.ownReturnRate === undefined
                    ? undefined
                    : settings.ownReturnRate / 100,
            feePer100Nutrition: settings.fee,
            premium: settings.premium,
            resourcePrice: (marketId) =>
                buyPrice(quotes, marketId, buyCity(marketId))?.price,
            sale: (marketId) => saleOf(marketId) ?? { kind: "sellOrder" },
        }).map((row) => ({
            ...row,
            sale: saleOf(row.marketId),
            buyPrices: new Map(
                row.result.resources.flatMap(({ marketId }) => {
                    const price = buyPrice(quotes, marketId, buyCity(marketId));

                    return price ? [[marketId, price] as const] : [];
                }),
            ),
        }));
    }, [catalog, quotes, now, cities, settings]);

    return {
        cells,
        now,
        isCatalogPending,
        isPricesPending: prices.isPending && prices.fetchStatus !== "idle",
        isPricesFetching: prices.isFetching,
        pricesError: prices.error,
    };
}
