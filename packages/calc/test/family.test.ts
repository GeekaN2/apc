import { describe, expect, it } from "vitest";
import {
    EQUIPMENT_CATEGORIES,
    craftFamily,
    craftableFamilies,
    enchantmentLevels,
    familyMarketIds,
    familyRecipe,
    recipeVariantCount,
} from "../src/family.ts";
import { CLUSTERS, getItem, loadCatalog } from "./catalog.ts";

const catalog = loadCatalog();
const families = craftableFamilies(catalog, EQUIPMENT_CATEGORIES);
const family = (key: string) => {
    const found = families.find((f) => f.key === key);

    if (!found) {
        throw new Error(`No family ${key}`);
    }

    return found;
};

describe("craftableFamilies", () => {
    it("groups tiers of an item", () => {
        const sword = family("MAIN_SWORD");

        expect(sword.shopCategory).toBe("weapons");
        expect(sword.shopSubcategory1).toBe("sword");
        expect(sword.items.map((item) => item.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("keeps only craftable equipment", () => {
        expect(
            families.every((f) => EQUIPMENT_CATEGORIES.includes(f.shopCategory as never)),
        ).toBe(true);
        expect(families.some((f) => f.key === "METALBAR")).toBe(false);
    });
});

describe("enchantmentLevels", () => {
    it("lists the nested enchantments", () => {
        expect(enchantmentLevels(getItem(catalog, "T4_MAIN_SWORD"))).toEqual([
            0, 1, 2, 3, 4,
        ]);
    });
});

describe("recipe variants", () => {
    it("crafts an Avalonian weapon from its artifact or an energy token", () => {
        const claymore = family("2H_CLAYMORE_AVALON");
        const t6 = getItem(catalog, "T6_2H_CLAYMORE_AVALON");

        expect(recipeVariantCount(claymore)).toBe(2);
        expect(familyRecipe(t6, 0, 0)?.craftResource.at(-1)?.uniqueName).toBe(
            "T6_ARTEFACT_2H_CLAYMORE_AVALON",
        );
        expect(familyRecipe(t6, 1, 1)?.craftResource.at(-1)?.uniqueName).toBe(
            "T6_ARTEFACT_TOKEN_FAVOR_4",
        );
    });

    it("falls back to the last variant of an item with fewer of them", () => {
        const sword = getItem(catalog, "T4_MAIN_SWORD");

        expect(familyRecipe(sword, 0, 5)).toBe(sword.craftingRequirements[0]);
    });
});

describe("familyMarketIds", () => {
    it("prices enchanted products, their resources, components and journals", () => {
        const ids = familyMarketIds(catalog, family("CAPEITEM_FW_CAERLEON"), 0);

        expect(ids).toEqual(
            expect.arrayContaining([
                "T4_CAPEITEM_FW_CAERLEON",
                "T4_CAPEITEM_FW_CAERLEON@1",
                "T4_CAPE",
                "T4_CAPEITEM_FW_CAERLEON_BP",
                "T1_FACTION_CAERLEON_TOKEN_1",
            ]),
        );

        const swordIds = familyMarketIds(catalog, family("MAIN_SWORD"), 0);

        expect(swordIds).toEqual(
            expect.arrayContaining([
                "T5_MAIN_SWORD@3",
                "T5_METALBAR_LEVEL3@3",
                "T5_JOURNAL_WARRIOR_EMPTY",
                "T5_JOURNAL_WARRIOR_FULL",
            ]),
        );
    });
});

describe("craftFamily", () => {
    const prices: Record<string, number> = {
        T4_MAIN_SWORD: 10_000,
        T4_METALBAR: 200,
        T4_LEATHER: 150,
        T4_JOURNAL_WARRIOR_EMPTY: 1_000,
        T4_JOURNAL_WARRIOR_FULL: 5_000,
    };
    const cells = craftFamily({
        catalog,
        family: family("MAIN_SWORD"),
        variant: 0,
        clusterId: CLUSTERS.Lymhurst,
        useFocus: false,
        feePer100Nutrition: 500,
        premium: true,
        crafts: 2,
        resourcePrice: (id) => prices[id],
        sale: (id) => ({ price: prices[id], kind: "sellOrder" }),
        journal: (journal) => ({
            emptyPrice: prices[`${journal.uniqueName}_EMPTY`],
            fullSale: { price: prices[`${journal.uniqueName}_FULL`], kind: "sellOrder" },
        }),
    });
    const t4 = cells.find((cell) => cell.marketId === "T4_MAIN_SWORD")!;

    it("has a cell for every tier and enchantment level", () => {
        expect(cells.filter((cell) => cell.tier === 4)).toHaveLength(5);
        expect(cells.find((cell) => cell.marketId === "T8_MAIN_SWORD@4")).toBeDefined();
    });

    it("uses the crafting specialization of the city", () => {
        expect(t4.returnRate).toBeCloseTo(1 - 1 / 1.33, 10);
    });

    it("counts both crafts and the journal", () => {
        expect(t4.result.amountCrafted).toBe(2);
        expect(t4.result.journal?.profit).toBeGreaterThan(0);
        expect(t4.result.profit).toBeDefined();
    });

    it("leaves the profit undefined without prices", () => {
        const t5 = cells.find((cell) => cell.marketId === "T5_MAIN_SWORD")!;

        expect(t5.result.profit).toBeUndefined();
    });
});
