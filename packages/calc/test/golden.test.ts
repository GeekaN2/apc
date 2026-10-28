/**
 * Golden tests: the new engine on the catalog against the old calculator's formulas
 * (test/legacy) with the same prices. Old rounding is per line, so money values
 * may differ by one silver per rounded line.
 */
import { describe, expect, it } from "vitest";
import { itemMarketId, recipesOf } from "../src/catalog.ts";
import { craft } from "../src/craft.ts";
import { productionBonus, returnRate } from "../src/returnRate.ts";
import { CLUSTERS, type City, fakePrice, getItem, loadCatalog } from "./catalog.ts";
import { legacyFoodCell } from "./legacy/food.ts";
import {
    LEGACY_ITEM_VALUES,
    type LegacyTreeInput,
    legacyTreeRow,
} from "./legacy/profitTree.ts";
import { legacyRefiningRow } from "./legacy/refining.ts";

const catalog = loadCatalog();
const CITIES = Object.keys(CLUSTERS) as City[];
const TIERS = [4, 5, 6, 7, 8];
const SUBTIERS = [0, 1, 2, 3, 4];
const FOCUS = [false, true];
const FEE = 800;
const price = (marketId: string) => fakePrice(marketId);

/** Item values per material without the two typos of the old table */
const CORRECT_ITEM_VALUES = LEGACY_ITEM_VALUES.map((row, subtier) =>
    row.map((_, tier) => 16 * 2 ** (tier + subtier)),
);

function bonusRate(uniqueName: string, city: City, useFocus: boolean) {
    const item = getItem(catalog, uniqueName);

    return returnRate(
        productionBonus({
            modifiers: catalog.modifiers,
            item,
            clusterId: CLUSTERS[city],
            useFocus,
        }),
    );
}

type TreeCase = Pick<
    LegacyTreeInput,
    "name" | "parent" | "root" | "artefactLevel" | "recipe"
>;

const TREE_ITEMS: TreeCase[] = [
    {
        name: "T4_MAIN_SWORD",
        parent: "T4_MAIN_SWORD",
        root: "ROOT_WARRIOR",
        artefactLevel: "",
        recipe: { METALBAR: 16, LEATHER: 8 },
    },
    {
        name: "T4_MAIN_SCIMITAR_MORGANA",
        parent: "T4_MAIN_SWORD",
        root: "ROOT_WARRIOR",
        artefactLevel: "rune",
        recipe: { METALBAR: 16, LEATHER: 8 },
    },
    {
        name: "T4_2H_CLAYMORE_AVALON",
        parent: "T4_MAIN_SWORD",
        root: "ROOT_WARRIOR",
        artefactLevel: "avalon",
        recipe: { METALBAR: 20, LEATHER: 12 },
    },
    {
        name: "T4_ARMOR_PLATE_SET1",
        parent: "T4_ARMOR_PLATE_SET1",
        root: "ROOT_WARRIOR",
        artefactLevel: "",
        recipe: { METALBAR: 16 },
    },
    {
        name: "T4_OFF_SHIELD",
        parent: "T4_OFF_SHIELD",
        root: "ROOT_WARRIOR",
        artefactLevel: "",
        recipe: { PLANKS: 4, METALBAR: 4 },
    },
    {
        name: "T4_MAIN_CURSEDSTAFF_UNDEAD",
        parent: "T4_MAIN_CURSEDSTAFF",
        root: "ROOT_MAGE",
        artefactLevel: "rune",
        recipe: { PLANKS: 16, METALBAR: 8 },
    },
    {
        name: "T4_2H_TOOL_PICK",
        parent: "T4_2H_TOOL_PICK",
        root: "ROOT_TOOLMAKER",
        artefactLevel: "",
        recipe: { PLANKS: 6, METALBAR: 2 },
    },
];

describe("profit tree", () => {
    it.each(TREE_ITEMS)("$name: return rate matches the old percentages", (treeItem) => {
        for (const city of CITIES) {
            for (const useFocus of FOCUS) {
                const legacy = legacyTreeRow({
                    ...treeItem,
                    tier: 4,
                    subtier: 0,
                    city,
                    useFocus,
                    craftFee: FEE,
                    useJournals: false,
                    itemsMultiplier: 1,
                    price,
                });

                expect(
                    bonusRate(treeItem.name, city, useFocus),
                    `${city} ${useFocus}`,
                ).toBeCloseTo(legacy.returnPercentage / 100, 2);
            }
        }
    });

    it.each(TREE_ITEMS)("$name: every tier, enchantment and city", (treeItem) => {
        for (const tier of TIERS) {
            for (const subtier of SUBTIERS) {
                for (const city of CITIES) {
                    const item = getItem(catalog, `T${tier}${treeItem.name.slice(2)}`);
                    const recipe = recipesOf(item, subtier)[0];
                    const journal = catalog.journalFor(item.uniqueName)!;

                    // Tools lost their enchantments in the game, the old calculator listed them
                    if (!recipe) {
                        expect(item.uniqueName).toContain("_TOOL_");
                        expect(subtier).toBeGreaterThan(0);
                        continue;
                    }
                    const legacy = legacyTreeRow({
                        ...treeItem,
                        tier,
                        subtier,
                        city,
                        useFocus: false,
                        craftFee: FEE,
                        useJournals: true,
                        itemsMultiplier: 1,
                        price,
                        itemValues: CORRECT_ITEM_VALUES,
                    });
                    const result = craft({
                        catalog,
                        item,
                        recipe,
                        resourcePrice: price,
                        sale: {
                            price: price(itemMarketId(item, subtier)),
                            kind: "sellOrder",
                        },
                        returnRate: legacy.returnPercentage / 100,
                        feePer100Nutrition: FEE,
                        journal: {
                            journal,
                            emptyPrice: price(`${journal.uniqueName}_EMPTY`),
                            fullSale: {
                                price: price(`${journal.uniqueName}_FULL`),
                                kind: "sellOrder",
                            },
                        },
                    });
                    const label = `${item.uniqueName}@${subtier} ${city}`;
                    const resources = result.resources.reduce((s, r) => s + r.cost!, 0);
                    const filled = result.journal!.filled;
                    // The old calculator took the market fee from the empty journal too
                    const journalFeeFix =
                        filled * price(`${journal.uniqueName}_EMPTY`) * 0.065;

                    expect(journal.uniqueName, label).toBe(
                        `T${tier}_JOURNAL${treeItem.root.slice(4)}`,
                    );
                    expect(result.missingPrices, label).toEqual([]);
                    expect(result.income! - legacy.sell, label).toBeLessThan(1);
                    expect(
                        Math.abs(resources - legacy.resources - legacy.artefact),
                        label,
                    ).toBeLessThanOrEqual(result.resources.length);
                    // Old artifact values were rounded: T8_rune 63.5 instead of 64 per material
                    expect(
                        Math.abs(result.stationFee - legacy.fee),
                        label,
                    ).toBeLessThanOrEqual(legacy.fee * 0.01 + 1);
                    expect(
                        Math.abs(
                            result.journal!.profit! - (legacy.journals - journalFeeFix),
                        ),
                        label,
                    ).toBeLessThan(1);
                    expect(
                        Math.abs(
                            result.profit! -
                                (legacy.profit +
                                    legacy.fee -
                                    result.stationFee -
                                    journalFeeFix),
                        ),
                        label,
                    ).toBeLessThanOrEqual(result.resources.length + 3);
                }
            }
        }
    });

    it("the old item value table had two typos", () => {
        const diffs = LEGACY_ITEM_VALUES.flatMap((row, subtier) =>
            row.flatMap((value, tier) =>
                value === CORRECT_ITEM_VALUES[subtier]![tier]
                    ? []
                    : [`T${tier + 4}.${subtier}: ${value}`],
            ),
        );

        expect(diffs).toEqual(["T5.1: 62", "T7.4: 2056"]);
    });
});

const MATERIALS = ["METALBAR", "LEATHER", "CLOTH", "PLANKS", "STONEBLOCK"];

describe("refining", () => {
    it.each(MATERIALS)("%s: every tier, enchantment and city", (material) => {
        for (const tier of TIERS) {
            for (const subtier of SUBTIERS) {
                for (const city of CITIES) {
                    for (const useFocus of FOCUS) {
                        const item = catalog.item(
                            `T${tier}_${material}` + (subtier ? `_LEVEL${subtier}` : ""),
                        );

                        // The game has no enchanted stone blocks, the old calculator listed them
                        if (!item) {
                            expect(material).toBe("STONEBLOCK");
                            continue;
                        }

                        const recipe = item.craftingRequirements[0]!;
                        const legacy = legacyRefiningRow({
                            material,
                            tier,
                            subtier,
                            city,
                            useFocus,
                            fee: FEE,
                            price,
                        });
                        const result = craft({
                            catalog,
                            item,
                            recipe,
                            resourcePrice: price,
                            sale: { price: price(itemMarketId(item)), kind: "sellOrder" },
                            returnRate: legacy.returnPercentage / 100,
                            feePer100Nutrition: FEE,
                        });
                        const label = `${item.uniqueName} ${city} ${useFocus}`;
                        const [raw, previous] = result.resources;

                        expect(
                            bonusRate(item.uniqueName, city, useFocus),
                            label,
                        ).toBeCloseTo(legacy.returnPercentage / 100, 2);
                        expect(result.income! - legacy.sell, label).toBeLessThan(1);
                        expect(raw!.cost! - legacy.rawResource, label).toBeLessThan(1);
                        expect(previous!.cost! - legacy.material, label).toBeLessThan(1);
                        expect(legacy.fee - result.stationFee, label).toBeLessThan(1);
                        expect(
                            Math.abs(result.profit! - legacy.profit),
                            label,
                        ).toBeLessThan(3);
                    }
                }
            }
        }
    });
});

const FOOD = [
    "T4_MEAL_STEW",
    "T6_MEAL_STEW",
    "T8_MEAL_SANDWICH",
    "T4_MEAL_SANDWICH_AVALON",
    "T4_POTION_HEAL",
    "T6_POTION_HEAL",
    "T5_POTION_STONESKIN",
];

describe("food and potions", () => {
    it.each(FOOD)("%s: every enchantment and city", (uniqueName) => {
        const item = getItem(catalog, uniqueName);
        const levels = [0, ...item.enchantments.map((e) => e.enchantmentLevel)];

        for (const level of levels) {
            for (const city of CITIES) {
                for (const useFocus of FOCUS) {
                    const recipe = recipesOf(item, level)[0]!;
                    const marketId = itemMarketId(item, level);
                    const result = craft({
                        catalog,
                        item,
                        recipe,
                        resourcePrice: price,
                        sale: { price: price(marketId), kind: "sellOrder" },
                        returnRate: bonusRate(uniqueName, city, useFocus),
                        feePer100Nutrition: FEE,
                    });
                    const legacy = legacyFoodCell({
                        itemName: marketId,
                        amountCrafted: recipe.amountCrafted ?? 1,
                        resources: result.resources,
                        city,
                        useFocus,
                        fee: FEE,
                        price,
                    });
                    const label = `${marketId} ${city} ${useFocus}`;
                    const resources = result.resources.reduce((s, r) => s + r.cost!, 0);
                    const rate = legacy.returnPercentage / 100;
                    const legacyRateResources = result.resources.reduce(
                        (s, r) =>
                            s + r.unitPrice! * r.count * (r.returned ? 1 - rate : 1),
                        0,
                    );

                    expect(bonusRate(uniqueName, city, useFocus), label).toBeCloseTo(
                        rate,
                        2,
                    );
                    expect(result.income, label).toBeCloseTo(legacy.sell, 6);
                    expect(legacyRateResources, label).toBeCloseTo(legacy.resources, 6);
                    // The dumps give no item value to alchemy extracts, the old calculator used 40
                    const extracts = result.resources
                        .filter((r) => r.marketId.includes("ALCHEMY_EXTRACT"))
                        .reduce((s, r) => s + r.count, 0);

                    expect(result.itemValue, label).toBe(
                        legacy.itemValue - 40 * extracts,
                    );
                    expect(Math.abs(resources - legacy.resources), label).toBeLessThan(
                        legacy.resources * 0.001,
                    );
                }
            }
        }
    });
});
