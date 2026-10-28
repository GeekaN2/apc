import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    buildCategories,
    buildCraftingModifiers,
    buildGameConstants,
    buildItems,
    buildNames,
    findUnknownMarketIds,
} from "../src/build.ts";
import { marketIds } from "../src/ids.ts";
import type { Item } from "../src/model.ts";

/** Fixtures are real entries cut from ao-bin-dumps 1a469e53 */
function fixture(file: string): unknown {
    return JSON.parse(
        readFileSync(path.join(import.meta.dirname, "fixtures", file), "utf8"),
    );
}

const itemsJson = fixture("items.json");
const formattedJson = fixture("formatted-items.json");
const localizationJson = fixture("localization.json");

const items = buildItems(itemsJson);

function item(uniqueName: string): Item {
    const found = items.find((i) => i.uniqueName === uniqueName);

    if (!found) {
        throw new Error(`No ${uniqueName} in fixtures`);
    }

    return found;
}

describe("buildItems", () => {
    it("keeps the dump section as kind and skips mount skins", () => {
        expect(items.map((i) => [i.uniqueName, i.kind])).toEqual([
            ["T4_MAIN_SWORD", "weapon"],
            ["T4_MAIN_SCIMITAR_MORGANA", "weapon"],
            ["T4_METALBAR", "simpleitem"],
            ["T4_METALBAR_LEVEL1", "simpleitem"],
            ["T5_WOOD", "simpleitem"],
            ["T4_ARTEFACT_MAIN_SCIMITAR_MORGANA", "simpleitem"],
            ["T4_POTION_HEAL", "consumableitem"],
            ["T4_JOURNAL_WARRIOR", "journalitem"],
        ]);
    });

    it("parses equipment with nested enchantments", () => {
        const sword = item("T4_MAIN_SWORD");

        expect(sword).toMatchObject({
            tier: 4,
            shopCategory: "weapons",
            shopSubcategory1: "sword",
            shopSubcategory2: "sword_sword",
            craftingCategory: "sword",
            itemPower: 700,
            maxQualityLevel: 5,
            twoHanded: false,
        });
        expect(sword.craftingRequirements).toEqual([
            {
                silver: 0,
                time: 1,
                craftingFocus: 1286,
                craftResource: [
                    { uniqueName: "T4_METALBAR", count: 16 },
                    { uniqueName: "T4_LEATHER", count: 8 },
                ],
                currency: [],
            },
        ]);
        expect(sword.enchantments.map((e) => e.enchantmentLevel)).toEqual([1, 2, 3, 4]);
        expect(sword.enchantments[0]).toMatchObject({
            itemPower: 800,
            craftingRequirements: [
                {
                    craftResource: [
                        {
                            uniqueName: "T4_METALBAR_LEVEL1",
                            count: 16,
                            enchantmentLevel: 1,
                        },
                        {
                            uniqueName: "T4_LEATHER_LEVEL1",
                            count: 8,
                            enchantmentLevel: 1,
                        },
                    ],
                },
            ],
            upgradeRequirements: {
                upgradeResource: [{ uniqueName: "T4_RUNE", count: 288 }],
            },
        });
    });

    it("keeps every recipe variant", () => {
        const scimitar = item("T4_MAIN_SCIMITAR_MORGANA");

        expect(scimitar.craftingRequirements.map((r) => r.craftResource)).toEqual([
            [
                { uniqueName: "T4_METALBAR", count: 16 },
                { uniqueName: "T4_LEATHER", count: 8 },
                {
                    uniqueName: "T4_ARTEFACT_MAIN_SCIMITAR_MORGANA",
                    count: 1,
                    maxReturnAmount: 0,
                },
            ],
            [
                { uniqueName: "T4_METALBAR", count: 16 },
                { uniqueName: "T4_LEATHER", count: 8 },
                { uniqueName: "T4_ARTEFACT_TOKEN_FAVOR_1", count: 1, maxReturnAmount: 0 },
            ],
        ]);
    });

    it("parses refining recipes of separate enchanted resources", () => {
        const bar = item("T4_METALBAR_LEVEL1");

        expect(bar).toMatchObject({ tier: 4, enchantmentLevel: 1, enchantments: [] });
        expect(bar.craftingRequirements).toHaveLength(2);
        expect(bar.craftingRequirements[0]).toEqual({
            silver: 0,
            time: 0.0625,
            craftingFocus: 94,
            amountCrafted: 1,
            craftButtonLocaOverride: "@CRAFTBUILDING_ITEM_DETAILS_BUTTON_REFINE",
            craftResource: [
                { uniqueName: "T4_ORE_LEVEL1", count: 2, enchantmentLevel: 1 },
                { uniqueName: "T3_METALBAR", count: 1, enchantmentLevel: 0 },
            ],
            currency: [],
        });
    });

    it("parses transmutation recipes", () => {
        expect(item("T5_WOOD").craftingRequirements).toEqual([
            {
                silver: 781,
                time: 0.00625,
                craftingFocus: 0,
                craftButtonLocaOverride: "@CRAFTBUILDING_ITEM_DETAILS_BUTTON_TRANSMUTE",
                craftResource: [
                    {
                        uniqueName: "T4_WOOD",
                        count: 1,
                        enchantmentLevel: 0,
                        maxReturnAmount: 0,
                    },
                ],
                currency: [],
            },
        ]);
    });

    it("parses consumables with enchantments", () => {
        const potion = item("T4_POTION_HEAL");

        expect(potion.craftingRequirements[0]).toMatchObject({
            amountCrafted: 5,
            forceSingleCraft: false,
            craftResource: [
                { uniqueName: "T4_BURDOCK", count: 24 },
                { uniqueName: "T3_EGG", count: 6 },
            ],
        });
        expect(potion.enchantments[0]).toMatchObject({
            enchantmentLevel: 1,
            upgradeRequirements: {
                upgradeResource: [{ uniqueName: "T1_ALCHEMY_EXTRACT_LEVEL1", count: 3 }],
            },
        });
    });

    it("parses journals", () => {
        const journal = item("T4_JOURNAL_WARRIOR");

        expect(journal).toMatchObject({ maxFame: 3600 });
        expect(journal.craftingRequirements).toEqual([
            {
                silver: 2000,
                time: 0,
                swapTransaction: true,
                craftResource: [],
                currency: [],
            },
        ]);
        expect(journal.fameFillingMissions?.craftItemFame).toMatchObject({
            minTier: 4,
            value: 1200,
        });
        expect(journal.fameFillingMissions?.craftItemFame?.validItem).toContain(
            "T4_MAIN_SWORD",
        );
    });

    it("drops fields that don't matter for the economy", () => {
        expect(Object.keys(item("T4_MAIN_SWORD"))).not.toContain("attackDamage");
        expect(JSON.stringify(item("T4_MAIN_SWORD"))).not.toContain("HEROICSTRIKE");
    });

    it("fails with the item name on a broken field", () => {
        const broken = structuredClone(itemsJson) as {
            items: { weapon: Record<string, unknown>[] };
        };

        broken.items.weapon[0]!["@tier"] = "four";

        expect(() => buildItems(broken)).toThrow(/weapon T4_MAIN_SWORD[\s\S]*@tier/);
    });

    it("fails on an unknown section", () => {
        const extended = structuredClone(itemsJson) as { items: Record<string, unknown> };

        extended.items.newitemkind = [];

        expect(() => buildItems(extended)).toThrow(/newitemkind/);
    });
});

describe("marketIds", () => {
    it("adds enchantment suffixes", () => {
        expect(marketIds(item("T4_MAIN_SWORD"))).toEqual([
            "T4_MAIN_SWORD",
            "T4_MAIN_SWORD@1",
            "T4_MAIN_SWORD@2",
            "T4_MAIN_SWORD@3",
            "T4_MAIN_SWORD@4",
        ]);
        expect(marketIds(item("T4_METALBAR_LEVEL1"))).toEqual(["T4_METALBAR_LEVEL1@1"]);
        expect(marketIds(item("T4_JOURNAL_WARRIOR"))).toEqual([
            "T4_JOURNAL_WARRIOR_EMPTY",
            "T4_JOURNAL_WARRIOR_FULL",
        ]);
    });

    it("produces only ids known to formatted/items.json", () => {
        expect(findUnknownMarketIds(items, formattedJson)).toEqual([]);
    });
});

describe("buildCategories", () => {
    it("builds the marketplace tree sorted by value", () => {
        const categories = buildCategories(itemsJson);

        expect(categories.map((c) => c.id)).toEqual(["weapons", "crafting"]);
        expect(categories[0]?.children.map((c) => c.id)).toEqual(["bow", "sword"]);
        expect(categories[0]?.children[0]?.children.map((c) => c.id)).toEqual([
            "bow_bow",
            "bow_longbow",
            "bow_warbow",
            "bow_undead",
            "bow_hell",
            "bow_keeper",
            "bow_avalon",
            "bow_crystal",
        ]);
    });
});

describe("buildNames", () => {
    const names = buildNames(formattedJson, localizationJson, buildCategories(itemsJson));
    const ru = names.get("ru-RU");

    it("splits names by locale", () => {
        expect([...names.keys()].sort()).toEqual(["en-US", "ru-RU"]);
        expect(ru?.items.T4_METALBAR).toBe("Слиток стали");
    });

    it("keeps @N names only when they differ from the base name", () => {
        expect(ru?.items["T4_METALBAR_LEVEL1@1"]).toBe("Необычный слиток стали");
        expect(ru?.items.T4_POTION_HEAL).toBe("Эликсир здоровья");
        expect(ru?.items).not.toHaveProperty("T4_POTION_HEAL@1");
    });

    it("names categories at every level", () => {
        expect(names.get("en-US")?.categories).toMatchObject({
            weapons: expect.any(String),
            bow: expect.any(String),
            bow_longbow: expect.any(String),
            refinedresources: expect.any(String),
        });
    });
});

describe("buildCraftingModifiers", () => {
    const modifiers = buildCraftingModifiers(
        fixture("craftingmodifiers.json"),
        fixture("world.json"),
    );

    it("lists refining categories", () => {
        expect(modifiers.refiningCategory).toEqual([
            "fiber",
            "ore",
            "rock",
            "wood",
            "hide",
        ]);
    });

    it("names city clusters and keeps their bonuses", () => {
        expect(modifiers.craftingLocation[0]).toEqual({
            clusterId: "1000",
            clusterName: "Lymhurst",
            craftingBonus: { value: 0.18, islandValue: 0 },
            refiningBonus: { value: 0.18, islandValue: 0 },
            craftingModifier: [
                { name: "fiber", value: 0.4 },
                { name: "meat_goose", value: 0.1 },
                { name: "sword", value: 0.15 },
                { name: "bow", value: 0.15 },
                { name: "arcanestaff", value: 0.15 },
                { name: "leather_helmet", value: 0.15 },
                { name: "leather_shoes", value: 0.15 },
            ],
        });
        expect(modifiers.craftingLocation[1]).toMatchObject({
            clusterName: "Brecilien",
            craftingModifier: [
                { name: "cape", value: 0.15 },
                { name: "bag", value: 0.15 },
                { name: "potion", value: 0.15 },
            ],
        });
    });

    it("keeps Outlands zones without a cluster", () => {
        expect(modifiers.craftingLocation[2]).toMatchObject({
            clusterId: undefined,
            continent: "OUTLANDS",
            biome: "SWAMP",
            clusterQuality: "Q1",
            refiningBonus: { value: 0.15 },
        });
    });
});

describe("buildGameConstants", () => {
    it("reads market taxes, nutrition, focus and fame factors", () => {
        expect(buildGameConstants(fixture("gamedata.json"))).toEqual({
            marketPlace: {
                setupFee: 0.025,
                transactionTax: 0.08,
                smugglerSetupFee: 0.015,
                smugglerTransactionTax: 0.08,
            },
            itemValueToNutrition: 0.1125,
            focusCraftingEfficiencyBonus: 0.59,
            craftItemFameFactor: 1,
        });
    });
});
