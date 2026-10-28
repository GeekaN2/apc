import {
    type Catalog,
    EQUIPMENT_CATEGORIES,
    type FamilyCell,
    type ItemFamily,
    craftFamily,
    craftableFamilies,
    enchantmentLevels,
    itemMarketId,
    familyMarketIds,
    recipeVariantCount,
} from "@apc/calc";
import { useMemo } from "react";
import { useAverages, usePrices } from "../../api/prices";
import { clusterIdOf, useEquipmentCatalog, useNames } from "../../catalog/catalog";
import { type PriceGroup, createPriceBook } from "../../prices/priceBook";
import { useManualPrices } from "../../store/manualPrices";
import { useTreeStore } from "../../store/tree";
import type { ProfitTableCell } from "../ProfitTable/ProfitTable";

export type TreeCell = FamilyCell & ProfitTableCell;

/** Refined resources are bought in their city, everything else with the artifacts */
function isRefined(catalog: Catalog, marketId: string): boolean {
    return catalog.item(marketId.split("@")[0]!)?.shopSubcategory1 === "refinedresources";
}

/** Item name without the tier: "Broadsword" out of "Expert's Broadsword" or "Палаш (знаток)" */
export function familyName(
    family: ItemFamily,
    names: Readonly<Record<string, string>> | undefined,
): string {
    const item = family.items.find((i) => i.tier === 4) ?? family.items[0]!;
    const name = names?.[item.uniqueName];

    if (!name) {
        return family.key;
    }

    return name
        .replace(/\s*\([^)]*\)$/, "")
        .replace(
            /^(Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's|Beginner's)\s+/,
            "",
        );
}

export function useTree() {
    const { family: familyKey, variant, settings } = useTreeStore();
    const catalog = useEquipmentCatalog();
    const names = useNames();
    const manual = useManualPrices();
    const families = useMemo(
        () => (catalog.data ? craftableFamilies(catalog.data, EQUIPMENT_CATEGORIES) : []),
        [catalog.data],
    );
    const family = families.find((f) => f.key === familyKey);
    const variants = family ? recipeVariantCount(family) : 1;
    const recipeVariant = Math.min(variant, variants - 1);
    const marketIds = useMemo(
        () =>
            catalog.data && family
                ? familyMarketIds(catalog.data, family, recipeVariant)
                : [],
        [catalog.data, family, recipeVariant],
    );
    const { cities, qualities } = settings;
    const prices = usePrices(
        marketIds,
        [cities.sell, cities.resources, cities.components, cities.journals],
        qualities,
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
        const data = catalog.data;

        if (!data || !family) {
            return { cells: [], priceGroups: [] };
        }

        const book = createPriceBook({
            quotes,
            manual,
            marketPlace: data.constants.marketPlace,
            premium: settings.premium,
            now,
        });
        const buyCity = (marketId: string) =>
            isRefined(data, marketId) ? cities.resources : cities.components;
        const products = new Set(productIds);
        const isJournal = (marketId: string) =>
            /_JOURNAL_.+_(EMPTY|FULL)$/.test(marketId);

        const cells: TreeCell[] = craftFamily({
            catalog: data,
            family,
            variant: recipeVariant,
            clusterId: clusterIdOf(data, cities.craft),
            useFocus: settings.useFocus,
            returnRate:
                settings.ownReturnRate === undefined
                    ? undefined
                    : settings.ownReturnRate / 100,
            feePer100Nutrition: settings.fee,
            premium: settings.premium,
            crafts: settings.crafts,
            resourcePrice: (marketId) => book.buy(marketId, buyCity(marketId))?.price,
            sale: (marketId) =>
                book.sell(marketId, cities.sell, qualities) ?? { kind: "sellOrder" },
            journal: settings.useJournals
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
                sale: book.sell(cell.marketId, cities.sell, qualities),
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
                    market: book.marketSell(marketId, cities.sell, qualities),
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
                rows: settings.useJournals
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
        catalog.data,
        family,
        recipeVariant,
        marketIds,
        productIds,
        quotes,
        manual,
        averages.data,
        now,
        cities,
        qualities,
        settings,
    ]);

    return {
        catalog: catalog.data,
        names: names.data,
        families,
        family,
        variants,
        recipeVariant,
        cells,
        priceGroups,
        now,
        isCatalogPending: catalog.isPending || names.isPending,
        isPricesFetching: prices.isFetching,
        pricesError: prices.error,
    };
}
