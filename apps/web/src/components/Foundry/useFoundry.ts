import {
    type FoundryArtifact,
    type FoundryGroup,
    artifactBranches,
    foundry,
    foundryGroup,
} from "@apc/calc";
import { useMemo } from "react";
import { useAverages, usePrices } from "../../api/prices";
import { useEquipmentCatalog, useNames } from "../../catalog/catalog";
import { type PriceGroup, type SalePrice, createPriceBook } from "../../prices/priceBook";
import { useFoundryStore } from "../../store/foundry";
import { useManualPrices } from "../../store/manualPrices";

export const TIERS = [4, 5, 6, 7, 8] as const;

/** Rows of the table: journal branches, artifacts outside them and everything */
export const ROWS = ["WARRIOR", "HUNTER", "MAGE", "TOOLMAKER", "OTHER", "ALL"] as const;

export type FoundryRow = (typeof ROWS)[number];

export interface FoundryLine extends FoundryArtifact {
    sale?: SalePrice;
    soldPerDay?: number;
}

function inRow(artifact: FoundryArtifact, row: FoundryRow): boolean {
    return row === "ALL" || (artifact.branch ?? "OTHER") === row;
}

export function useFoundry() {
    const { fragment, settings } = useFoundryStore();
    const catalog = useEquipmentCatalog();
    const names = useNames();
    const manual = useManualPrices();
    const branches = useMemo(
        () => (catalog.data ? artifactBranches(catalog.data) : new Map<string, string>()),
        [catalog.data],
    );
    const fragmentIds = useMemo(
        () => TIERS.map((tier) => `T${tier}_${fragment}`),
        [fragment],
    );
    // Artifacts with their recipes, independent of prices
    const artifactIds = useMemo(
        () =>
            catalog.data
                ? foundry(
                      {
                          catalog: catalog.data,
                          fragment,
                          resourcePrice: () => undefined,
                          sale: () => ({ kind: "sellOrder" }),
                          returnRate: 0,
                          feePer100Nutrition: 0,
                          premium: true,
                      },
                      branches,
                  ).map((a) => a.marketId)
                : [],
        [catalog.data, fragment, branches],
    );
    const { sell, buy } = settings.cities;
    const marketIds = useMemo(
        () => [...fragmentIds, ...artifactIds],
        [fragmentIds, artifactIds],
    );
    const prices = usePrices(marketIds, [sell, buy]);
    const averages = useAverages(artifactIds, sell);
    const quotes = prices.data;
    const now = prices.dataUpdatedAt;

    const { groups, priceGroups } = useMemo(() => {
        const data = catalog.data;
        const groups = new Map<string, FoundryGroup & { artifacts: FoundryLine[] }>();

        if (!data) {
            return { groups, priceGroups: [] as PriceGroup[] };
        }

        const book = createPriceBook({
            quotes,
            manual,
            marketPlace: data.constants.marketPlace,
            premium: settings.premium,
            now,
        });
        const lines: FoundryLine[] = foundry(
            {
                catalog: data,
                fragment,
                resourcePrice: (marketId) => book.buy(marketId, buy)?.price,
                sale: (marketId) => book.sell(marketId, sell) ?? { kind: "sellOrder" },
                returnRate: (settings.ownReturnRate ?? 0) / 100,
                feePer100Nutrition: settings.fee,
                premium: settings.premium,
            },
            branches,
        ).map((artifact) => ({
            ...artifact,
            sale: book.sell(artifact.marketId, sell),
            soldPerDay: averages.data?.get(artifact.marketId)?.averageItems,
        }));

        for (const row of ROWS) {
            for (const tier of TIERS) {
                const group = foundryGroup(
                    lines.filter((line) => line.tier === tier && inRow(line, row)),
                );

                groups.set(
                    `${row}|${tier}`,
                    group as FoundryGroup & { artifacts: FoundryLine[] },
                );
            }
        }

        const priceGroups: PriceGroup[] = [
            {
                key: "components",
                rows: fragmentIds.map((marketId) => ({
                    marketId,
                    market: book.marketBuy(marketId, buy),
                })),
            },
        ];

        return { groups, priceGroups };
    }, [
        catalog.data,
        fragment,
        branches,
        fragmentIds,
        quotes,
        manual,
        averages.data,
        now,
        sell,
        buy,
        settings,
    ]);

    /** Rows that have artifacts of this fragment at all */
    const rows = ROWS.filter((row) =>
        TIERS.some((tier) => {
            const group = groups.get(`${row}|${tier}`);

            return group && group.artifacts.length + group.unpriced.length > 0;
        }),
    );

    return {
        rows,
        group: (row: string, tier: number) => groups.get(`${row}|${tier}`),
        priceGroups,
        fragmentIds,
        names: names.data,
        now,
        isCatalogPending: catalog.isPending || names.isPending,
        isPricesFetching: prices.isFetching,
        pricesError: prices.error,
    };
}
