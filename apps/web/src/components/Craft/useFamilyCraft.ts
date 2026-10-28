import {
    type Catalog,
    type FamilyCell,
    type ItemFamily,
    craftFamily,
    enchantmentLevels,
    familyMarketIds,
    itemMarketId,
} from "@apc/calc";
import { useMemo } from "react";
import { useAverages, usePrices } from "../../api/prices";
import { type City, type CraftingCity, clusterIdOf } from "../../catalog/catalog";
import { type PriceGroup, createPriceBook } from "../../prices/priceBook";
import { useManualPrices } from "../../store/manualPrices";
import type { ProfitTableCell } from "../ProfitTable/ProfitTable";

export type CraftCell = FamilyCell & ProfitTableCell;

/** Where each kind of thing is bought and sold */
export interface CraftCities {
    sell: City;
    /** The city bonus */
    craft: CraftingCity;
    /** Refined resources */
    resources: City;
    /** Everything else a recipe takes */
    components: City;
    journals: City;
}

export interface CraftParams {
    useFocus: boolean;
    premium: boolean;
    /** Station fee per 100 nutrition */
    fee: number;
    crafts: number;
    /** Return rate in percent instead of the one from the city and focus */
    ownReturnRate?: number;
    useJournals: boolean;
    /** Qualities whose prices are merged into the sale price */
    qualities: readonly number[];
}

/** Refined resources are bought in their city, everything else with the components */
function isRefined(catalog: Catalog, marketId: string): boolean {
    return catalog.item(marketId.split("@")[0]!)?.shopSubcategory1 === "refinedresources";
}

/** Prices and profit of every tier and enchantment level of a family */
export function useFamilyCraft(
    catalog: Catalog | undefined,
    family: ItemFamily | undefined,
    variant: number,
    params: CraftParams,
    cities: CraftCities,
) {
    const manual = useManualPrices();
    const marketIds = useMemo(
        () => (catalog && family ? familyMarketIds(catalog, family, variant) : []),
        [catalog, family, variant],
    );
    const prices = usePrices(
        marketIds,
        [cities.sell, cities.resources, cities.components, cities.journals],
        params.qualities,
    );
    const productIds = useMemo(
        () =>
            family?.items.flatMap((item) =>
                enchantmentLevels(item).map((level) => itemMarketId(item, level)),
            ) ?? [],
        [family],
    );
    const averages = useAverages(productIds, cities.sell);
    const quotes = prices.data;
    /** Prices are as old as of their loading, not of each render */
    const now = prices.dataUpdatedAt;

    const { cells, priceGroups } = useMemo(() => {
        const data = catalog;

        if (!data || !family) {
            return { cells: [], priceGroups: [] };
        }

        const book = createPriceBook({
            quotes,
            manual,
            marketPlace: data.constants.marketPlace,
            premium: params.premium,
            now,
        });
        const buyCity = (marketId: string) =>
            isRefined(data, marketId) ? cities.resources : cities.components;
        const products = new Set(productIds);
        const isJournal = (marketId: string) =>
            /_JOURNAL_.+_(EMPTY|FULL)$/.test(marketId);

        const cells: CraftCell[] = craftFamily({
            catalog: data,
            family,
            variant,
            clusterId: clusterIdOf(data, cities.craft),
            useFocus: params.useFocus,
            returnRate:
                params.ownReturnRate === undefined
                    ? undefined
                    : params.ownReturnRate / 100,
            feePer100Nutrition: params.fee,
            premium: params.premium,
            crafts: params.crafts,
            resourcePrice: (marketId) => book.buy(marketId, buyCity(marketId))?.price,
            sale: (marketId) =>
                book.sell(marketId, cities.sell, params.qualities) ?? {
                    kind: "sellOrder",
                },
            journal: params.useJournals
                ? (journal) => ({
                      emptyPrice: book.buy(`${journal.uniqueName}_EMPTY`, cities.journals)
                          ?.price,
                      fullSale: book.sell(
                          `${journal.uniqueName}_FULL`,
                          cities.journals,
                      ) ?? {
                          kind: "sellOrder",
                      },
                  })
                : undefined,
        }).map((cell) => {
            const journal = cell.result.journal && data.journalFor(cell.item.uniqueName);

            return {
                ...cell,
                sale: book.sell(cell.marketId, cities.sell, params.qualities),
                soldPerDay: averages.data?.get(cell.marketId)?.averageItems,
                buyPrices: new Map(
                    cell.result.resources.flatMap(({ marketId }) => {
                        const price = book.buy(marketId, buyCity(marketId));

                        return price ? [[marketId, price] as const] : [];
                    }),
                ),
                journal: journal && {
                    empty: book.buy(`${journal.uniqueName}_EMPTY`, cities.journals),
                    full: book.sell(`${journal.uniqueName}_FULL`, cities.journals),
                },
            };
        });

        const resources = marketIds.filter((id) => !products.has(id) && !isJournal(id));
        const priceGroups: PriceGroup[] = [
            {
                key: "products",
                rows: productIds.map((marketId) => ({
                    marketId,
                    market: book.marketSell(marketId, cities.sell, params.qualities),
                })),
            },
            {
                key: "resources",
                rows: resources
                    .filter((id) => isRefined(data, id))
                    .map((marketId) => ({
                        marketId,
                        market: book.marketBuy(marketId, cities.resources),
                    })),
            },
            {
                key: "components",
                rows: resources
                    .filter((id) => !isRefined(data, id))
                    .map((marketId) => ({
                        marketId,
                        market: book.marketBuy(marketId, cities.components),
                    })),
            },
            {
                key: "journals",
                rows: params.useJournals
                    ? marketIds.filter(isJournal).map((marketId) => ({
                          marketId,
                          market: marketId.endsWith("_EMPTY")
                              ? book.marketBuy(marketId, cities.journals)
                              : book.marketSell(marketId, cities.journals),
                      }))
                    : [],
            },
        ];

        return { cells, priceGroups };
    }, [
        catalog,
        family,
        variant,
        marketIds,
        productIds,
        quotes,
        manual,
        averages.data,
        now,
        cities,
        params,
    ]);

    return {
        cells,
        priceGroups,
        now,
        isPricesFetching: prices.isFetching,
        pricesError: prices.error,
    };
}
