import type { CraftingRequirement } from "@apc/game-data";
import { describe, expect, it } from "vitest";
import { craft } from "../src/craft.ts";
import { itemMarketId } from "../src/catalog.ts";
import {
    bestTransmutations,
    calibrateSilverFactor,
    cheapestTransmutations,
    transmutationRecipes,
} from "../src/transmutation.ts";
import { fakePrice, getItem, loadCatalog } from "./catalog.ts";
import {
    LEGACY_PREV_SUBTIER_COST,
    LEGACY_PREV_TIER_COST,
    LEGACY_ROCK_COST,
    LEGACY_VALUES,
    legacyAllWays,
    legacyGlobalDiscount,
    legacyItemName,
    legacyTransmutationRow,
} from "./legacy/transmutations.ts";

const catalog = loadCatalog();
const RESOURCES = ["ORE", "HIDE", "FIBER", "WOOD"];
const FEE = 800;
const silverFactor = legacyGlobalDiscount(75_000, FEE);
const price = (marketId: string) => fakePrice(marketId);

function uniqueName(resource: string, tier: number, subtier: number) {
    return `T${tier}_${resource}` + (subtier ? `_LEVEL${subtier}` : "");
}

function recipeFrom(target: string, source: string): CraftingRequirement {
    const recipe = transmutationRecipes(getItem(catalog, target)).find(
        (r) => r.craftResource[0]?.uniqueName === source,
    );

    if (!recipe) {
        throw new Error(`No transmutation ${source} → ${target}`);
    }

    return recipe;
}

describe("transmutation recipes", () => {
    it.each(RESOURCES)("%s: silver matches the old tables", (resource) => {
        for (let tier = 4; tier <= 8; tier++) {
            for (let subtier = 0; subtier <= 4; subtier++) {
                const target = uniqueName(resource, tier, subtier);

                expect(getItem(catalog, target).itemValue, target).toBe(
                    LEGACY_VALUES[subtier]![tier - 4]! === 85.32
                        ? 85.34
                        : LEGACY_VALUES[subtier]![tier - 4],
                );

                if (tier > 4) {
                    const recipe = recipeFrom(
                        target,
                        uniqueName(resource, tier - 1, subtier),
                    );

                    expect(recipe.silver, `${target} from the previous tier`).toBe(
                        LEGACY_PREV_TIER_COST[subtier]![tier - 4],
                    );
                }

                if (subtier > 0) {
                    const recipe = recipeFrom(
                        target,
                        uniqueName(resource, tier, subtier - 1),
                    );

                    expect(recipe.silver, `${target} from the previous subtier`).toBe(
                        LEGACY_PREV_SUBTIER_COST[subtier]![tier - 4],
                    );
                }
            }
        }
    });

    it("the old rock costs are about 10% behind the game, and rocks got enchantments", () => {
        const silver = [5, 6, 7, 8].map(
            (tier) => recipeFrom(`T${tier}_ROCK`, `T${tier - 1}_ROCK`).silver,
        );

        expect(silver).toEqual([1180, 2640, 5640, 14080]);
        expect(LEGACY_ROCK_COST.slice(1)).toEqual([1070, 2400, 5120, 12800]);

        expect(recipeFrom("T5_ROCK_LEVEL1", "T5_ROCK").silver).toBe(1600);
    });
});

describe("transmutation profit", () => {
    it.each(RESOURCES)("%s: one step matches the old rows", (resource) => {
        for (let tier = 4; tier <= 8; tier++) {
            for (let subtier = 0; subtier <= 4; subtier++) {
                const item = getItem(catalog, uniqueName(resource, tier, subtier));
                const formulas = [
                    ...(tier > 4 ? (["prevTier"] as const) : []),
                    ...(subtier > 0 ? (["prevSubtier"] as const) : []),
                ];

                for (const formula of formulas) {
                    const legacy = legacyTransmutationRow(
                        resource,
                        tier,
                        subtier,
                        formula,
                        FEE,
                        silverFactor,
                        price,
                    );
                    const source =
                        formula === "prevTier"
                            ? uniqueName(resource, tier - 1, subtier)
                            : uniqueName(resource, tier, subtier - 1);
                    const result = craft({
                        catalog,
                        item,
                        recipe: recipeFrom(item.uniqueName, source),
                        resourcePrice: price,
                        sale: { price: price(itemMarketId(item)), kind: "sellOrder" },
                        returnRate: 0.5,
                        feePer100Nutrition: FEE,
                        silverFactor,
                    });
                    const label = `${item.uniqueName} ${formula}`;

                    expect(result.resources[0]?.marketId, label).toBe(
                        legacy.materialName,
                    );
                    expect(result.resources[0]?.returned, label).toBe(false);
                    // The old value table had 85.32 instead of 85.34 for T5.4
                    expect(
                        result.silver + result.stationFee - legacy.fee,
                        label,
                    ).toBeLessThan(1.02);

                    // The old previous-subtier row sold with a 4.5% fee instead of 6.5%
                    if (formula === "prevTier") {
                        expect(
                            Math.abs(result.profit! - legacy.profit),
                            label,
                        ).toBeLessThan(2);
                    }
                }
            }
        }
    });
});

describe("cheapestTransmutations", () => {
    it.each(RESOURCES)("%s: matches the old best ways", (resource) => {
        for (let tier = 4; tier <= 8; tier++) {
            for (let subtier = 0; subtier <= 4; subtier++) {
                const legacy = legacyAllWays(resource, tier, subtier, FEE, silverFactor);
                const paths = cheapestTransmutations(
                    catalog,
                    uniqueName(resource, tier, subtier),
                    {
                        silverFactor,
                        feePer100Nutrition: FEE,
                    },
                );

                for (const [legacyName, fee] of legacy) {
                    const name = legacyName.replace(/@\d$/, "");

                    expect(
                        paths.get(name)?.cost,
                        `${uniqueName(resource, tier, subtier)} → ${name}`,
                    ).toBeCloseTo(fee, 1);
                }

                expect(paths.size).toBe(legacy.size);
            }
        }
    });

    it("returns the steps of a chain", () => {
        const path = cheapestTransmutations(catalog, "T4_ORE", {
            silverFactor: 1,
            feePer100Nutrition: 0,
        }).get("T5_ORE_LEVEL1");

        expect(path?.steps.map((s) => `${s.from} → ${s.to}`)).toEqual([
            "T4_ORE → T5_ORE",
            "T5_ORE → T5_ORE_LEVEL1",
        ]);
        expect(path?.cost).toBe(781 + 2000);
    });
});

it("transmutes rocks into enchanted rocks, which the old calculator could not", () => {
    const path = cheapestTransmutations(catalog, "T4_ROCK", {
        silverFactor: 1,
        feePer100Nutrition: 0,
    }).get("T5_ROCK_LEVEL1");

    expect(path?.steps.map((s) => s.to)).toEqual(["T5_ROCK", "T5_ROCK_LEVEL1"]);
    expect(path?.cost).toBe(1180 + 1600);
});

describe("calibrateSilverFactor", () => {
    it("restores the silver factor from a cost seen in the game", () => {
        const item = getItem(catalog, "T4_ORE_LEVEL4");
        const recipe = recipeFrom(item.uniqueName, "T4_ORE_LEVEL3");

        expect(
            calibrateSilverFactor(catalog, item, recipe, {
                observedCost: 75_000,
                feePer100Nutrition: FEE,
            }),
        ).toBeCloseTo(silverFactor, 10);
    });
});

it("legacy item names keep the market suffix", () => {
    expect(legacyItemName("ORE", 5, 1)).toBe("T5_ORE_LEVEL1@1");
});

describe("bestTransmutations", () => {
    const options = {
        catalog,
        silverFactor: 1,
        feePer100Nutrition: 0,
        premium: true,
    };

    it("buys what is cheapest to transmute into the target", () => {
        const prices: Record<string, number> = {
            T4_ORE: 100,
            T5_ORE: 10_000,
            "T5_ORE_LEVEL1@1": 50_000,
        };
        const targets = bestTransmutations({
            ...options,
            resource: "ORE",
            buyPrice: (id) => prices[id],
            sale: (id) => ({ price: prices[id], kind: "sellOrder" }),
        });
        const target = targets.find((t) => t.item.uniqueName === "T5_ORE_LEVEL1")!;
        const income = 50_000 * (1 - 0.04 - 0.025);

        // T4 → T5 → T5.1 costs 781 + 2000, buying T5 and one step costs 10 000 + 2000
        expect(target.best?.source.uniqueName).toBe("T4_ORE");
        expect(target.best?.path.steps).toHaveLength(2);
        expect(target.best?.profit).toBeCloseTo(income - 100 - 781 - 2_000, 6);
        expect(target.ways).toBeGreaterThan(2);
    });

    it("has no best way without prices", () => {
        const targets = bestTransmutations({
            ...options,
            resource: "ROCK",
            buyPrice: () => undefined,
            sale: () => ({ kind: "sellOrder" }),
        });

        expect(targets.every((t) => t.best === undefined)).toBe(true);
        expect(targets.some((t) => t.item.uniqueName === "T5_ROCK_LEVEL1")).toBe(true);
    });
});
