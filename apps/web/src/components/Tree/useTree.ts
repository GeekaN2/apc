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
    hasPrice,
    pickSalePrice,
    recipeVariantCount,
} from "@apc/calc";
import { useMemo } from "react";
import {
    type QuoteMap,
    mergedQuote,
    quoteKey,
    useAverages,
    usePrices,
} from "../../api/prices";
import {
    type City,
    clusterIdOf,
    useEquipmentCatalog,
    useNames,
} from "../../catalog/catalog";
import { useTreeStore } from "../../store/tree";
import type { ProfitTableCell, UsedPrice } from "../ProfitTable/ProfitTable";

export type TreeCell = FamilyCell & ProfitTableCell;

/** Lowest sell order: resources are bought instantly */
function buyPrice(
    quotes: QuoteMap | undefined,
    marketId: string,
    city: City,
): UsedPrice | undefined {
    const quote = quotes?.get(quoteKey(marketId, city));

    return quote && hasPrice(quote.sellPriceMin)
        ? { price: quote.sellPriceMin, date: new Date(quote.sellPriceMinDate ?? 0) }
        : undefined;
}

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

    const cells = useMemo((): TreeCell[] => {
        const data = catalog.data;

        if (!data || !family) {
            return [];
        }

        const { marketPlace } = data.constants;
        const options = { marketPlace, now, premium: settings.premium };
        const buyCity = (marketId: string) =>
            isRefined(data, marketId) ? cities.resources : cities.components;
        const saleOf = (marketId: string) => {
            const quote = mergedQuote(quotes, marketId, cities.sell, qualities, now);

            return quote ? pickSalePrice(quote, options) : undefined;
        };
        const journalFull = (marketId: string) => {
            const quote = quotes?.get(quoteKey(marketId, cities.journals));

            return quote ? pickSalePrice(quote, options) : undefined;
        };

        return craftFamily({
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
            resourcePrice: (marketId) =>
                buyPrice(quotes, marketId, buyCity(marketId))?.price,
            sale: (marketId) => saleOf(marketId) ?? { kind: "sellOrder" },
            journal: settings.useJournals
                ? (journal) => ({
                      emptyPrice: buyPrice(
                          quotes,
                          `${journal.uniqueName}_EMPTY`,
                          cities.journals,
                      )?.price,
                      fullSale: journalFull(`${journal.uniqueName}_FULL`) ?? {
                          kind: "sellOrder",
                      },
                  })
                : undefined,
        }).map((cell) => {
            const journal = cell.result.journal && data.journalFor(cell.item.uniqueName);

            return {
                ...cell,
                sale: saleOf(cell.marketId),
                soldPerDay: averages.data?.get(cell.marketId)?.averageItems,
                buyPrices: new Map(
                    cell.result.resources.flatMap(({ marketId }) => {
                        const price = buyPrice(quotes, marketId, buyCity(marketId));

                        return price ? [[marketId, price] as const] : [];
                    }),
                ),
                journal: journal && {
                    empty: buyPrice(
                        quotes,
                        `${journal.uniqueName}_EMPTY`,
                        cities.journals,
                    ),
                    full: journalFull(`${journal.uniqueName}_FULL`),
                },
            };
        });
    }, [
        catalog.data,
        family,
        recipeVariant,
        quotes,
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
        now,
        isCatalogPending: catalog.isPending || names.isPending,
        isPricesFetching: prices.isFetching,
        pricesError: prices.error,
    };
}
