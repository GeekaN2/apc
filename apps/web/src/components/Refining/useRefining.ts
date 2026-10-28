import {
    type Catalog,
    type RefiningRow,
    itemMarketId,
    refinedItems,
    refining,
    refiningMarketIds,
} from "@apc/calc";
import { useMemo } from "react";
import { usePrices } from "../../api/prices";
import { clusterIdOf, useNames, useResourceCatalog } from "../../catalog/catalog";
import { type PriceGroup, createPriceBook } from "../../prices/priceBook";
import { useManualPrices } from "../../store/manualPrices";
import { useRefiningStore } from "../../store/refining";
import type { ProfitTableCell } from "../ProfitTable/ProfitTable";

export type RefiningCell = RefiningRow & ProfitTableCell;

/** Refined resources of the tier below are bought in their own city */
function isRefined(catalog: Catalog, marketId: string): boolean {
    return catalog.item(marketId.split("@")[0]!)?.shopSubcategory1 === "refinedresources";
}

export function useRefining() {
    const settings = useRefiningStore();
    const { data: catalog, isPending: isCatalogPending } = useResourceCatalog();
    const names = useNames();
    const manual = useManualPrices();
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

    const { cells, priceGroups } = useMemo(() => {
        if (!catalog) {
            return { cells: [], priceGroups: [] };
        }

        const book = createPriceBook({
            quotes,
            manual,
            marketPlace: catalog.constants.marketPlace,
            premium: settings.premium,
            now,
        });
        const buyCity = (marketId: string) =>
            isRefined(catalog, marketId) ? cities.buyMaterials : cities.buyRaw;
        const products = new Set(
            refinedItems(catalog, settings.resource).map((item) => itemMarketId(item)),
        );

        const cells: RefiningCell[] = refining({
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
            resourcePrice: (marketId) => book.buy(marketId, buyCity(marketId))?.price,
            sale: (marketId) => book.sell(marketId, cities.sell) ?? { kind: "sellOrder" },
        }).map((row) => ({
            ...row,
            sale: book.sell(row.marketId, cities.sell),
            buyPrices: new Map(
                row.result.resources.flatMap(({ marketId }) => {
                    const price = book.buy(marketId, buyCity(marketId));

                    return price ? [[marketId, price] as const] : [];
                }),
            ),
        }));

        // Refined resources are both sold and bought as the tier below: list them once
        const priceGroups: PriceGroup[] = [
            {
                key: "products",
                rows: [...products].map((marketId) => ({
                    marketId,
                    market: book.marketSell(marketId, cities.sell),
                })),
            },
            {
                key: "raw",
                rows: marketIds
                    .filter((id) => !isRefined(catalog, id))
                    .map((marketId) => ({
                        marketId,
                        market: book.marketBuy(marketId, cities.buyRaw),
                    })),
            },
        ];

        return { cells, priceGroups };
    }, [catalog, quotes, manual, now, cities, settings, marketIds]);

    return {
        cells,
        priceGroups,
        names: names.data,
        now,
        isCatalogPending,
        isPricesPending: prices.isPending && prices.fetchStatus !== "idle",
        isPricesFetching: prices.isFetching,
        pricesError: prices.error,
    };
}
