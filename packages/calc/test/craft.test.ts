import { describe, expect, it } from "vitest";
import { craftItemValue, itemMarketId, recipesOf } from "../src/catalog.ts";
import { craft } from "../src/craft.ts";
import { marketFee, saleIncome } from "../src/market.ts";
import { productionBonus, returnRate } from "../src/returnRate.ts";
import { stationFee } from "../src/stationFee.ts";
import { CLUSTERS, getItem, loadCatalog } from "./catalog.ts";

const catalog = loadCatalog();

function rate(uniqueName: string, clusterId: string | undefined, useFocus: boolean) {
    return returnRate(
        productionBonus({
            modifiers: catalog.modifiers,
            item: getItem(catalog, uniqueName),
            clusterId,
            useFocus,
        }),
    );
}

describe("returnRate", () => {
    it("adds city, specialization and focus bonuses", () => {
        expect(rate("T4_MAIN_SWORD", CLUSTERS.Martlock, false)).toBeCloseTo(
            1 - 1 / 1.18,
            10,
        );
        expect(rate("T4_MAIN_SWORD", CLUSTERS.Lymhurst, false)).toBeCloseTo(
            1 - 1 / 1.33,
            10,
        );
        expect(rate("T4_MAIN_SWORD", CLUSTERS.Lymhurst, true)).toBeCloseTo(
            1 - 1 / 1.92,
            10,
        );
        expect(rate("T4_MAIN_SWORD", undefined, true)).toBeCloseTo(1 - 1 / 1.59, 10);
    });

    it("uses the refining bonus for refined resources", () => {
        expect(rate("T5_METALBAR", CLUSTERS.Thetford, false)).toBeCloseTo(
            1 - 1 / 1.58,
            10,
        );
        expect(rate("T5_METALBAR", CLUSTERS.Lymhurst, false)).toBeCloseTo(
            1 - 1 / 1.18,
            10,
        );
    });

    it("gives Brecilien its potion and cape bonus", () => {
        expect(rate("T4_POTION_HEAL", CLUSTERS.Brecilien, false)).toBeCloseTo(
            1 - 1 / 1.33,
            10,
        );
        expect(rate("T4_CAPE", CLUSTERS.Brecilien, false)).toBeCloseTo(1 - 1 / 1.33, 10);
    });
});

describe("market", () => {
    it("charges the setup fee only for sell orders", () => {
        expect(marketFee("sellOrder")).toBeCloseTo(0.065, 10);
        expect(marketFee("buyOrder")).toBeCloseTo(0.04, 10);
        expect(marketFee("sellOrder", false)).toBeCloseTo(0.105, 10);
        expect(saleIncome(1000, "buyOrder", false)).toBeCloseTo(920, 10);
    });
});

describe("craftItemValue", () => {
    it("sums resource values for equipment", () => {
        const sword = getItem(catalog, "T4_MAIN_SWORD");

        expect(craftItemValue(sword, recipesOf(sword)[0]!, catalog)).toBe(16 * 24);
        expect(craftItemValue(sword, recipesOf(sword, 2)[0]!, catalog)).toBe(64 * 24);
    });

    it("adds the artifact value", () => {
        const scimitar = getItem(catalog, "T4_MAIN_SCIMITAR_MORGANA");

        expect(craftItemValue(scimitar, recipesOf(scimitar)[0]!, catalog)).toBe(
            16 * 24 + 96,
        );
    });

    it("uses the own value of refined resources", () => {
        const bar = getItem(catalog, "T5_METALBAR_LEVEL1");

        expect(craftItemValue(bar, bar.craftingRequirements[0]!, catalog)).toBe(64);
    });

    it("follows intermediate products: bread → flour → wheat", () => {
        const stew = getItem(catalog, "T4_MEAL_STEW");

        expect(craftItemValue(stew, recipesOf(stew)[0]!, catalog)).toBe((4 + 4 + 8) * 40);
    });
});

describe("craft", () => {
    const sword = getItem(catalog, "T4_MAIN_SWORD");
    const prices: Record<string, number> = {
        T4_MAIN_SWORD: 10_000,
        T4_METALBAR: 200,
        T4_LEATHER: 150,
        T4_JOURNAL_WARRIOR_EMPTY: 1_000,
        T4_JOURNAL_WARRIOR_FULL: 5_000,
    };
    const base = {
        catalog,
        item: sword,
        recipe: recipesOf(sword)[0]!,
        resourcePrice: (id: string) => prices[id],
        sale: { price: 10_000, kind: "sellOrder" as const },
        returnRate: 0.2,
        feePer100Nutrition: 1_000,
    };

    it("sums income, resources and the station fee", () => {
        const result = craft(base);
        const resources = (200 * 16 + 150 * 8) * 0.8;
        const fee = stationFee(384, 1_000);

        expect(result.income).toBeCloseTo(9_350, 10);
        expect(result.resources.map((r) => [r.marketId, r.count, r.cost])).toEqual([
            ["T4_METALBAR", 16, 200 * 16 * 0.8],
            ["T4_LEATHER", 8, 150 * 8 * 0.8],
        ]);
        expect(result.stationFee).toBeCloseTo(fee, 10);
        expect(result.cost).toBeCloseTo(resources + fee, 10);
        expect(result.profit).toBeCloseTo(9_350 - resources - fee, 10);
        expect(result.profitPercentage).toBeCloseTo(
            ((9_350 - resources - fee) / (resources + fee)) * 100,
            10,
        );
    });

    it("scales by the number of crafts", () => {
        const one = craft(base);
        const ten = craft({ ...base, crafts: 10 });

        expect(ten.amountCrafted).toBe(10);
        expect(ten.resources[0]?.count).toBe(160);
        expect(ten.profit).toBeCloseTo(one.profit! * 10, 6);
    });

    it("adds journal profit from refined resources fame", () => {
        const journal = getItem(catalog, "T4_JOURNAL_WARRIOR");
        const result = craft({
            ...base,
            journal: {
                journal,
                emptyPrice: 1_000,
                fullSale: { price: 5_000, kind: "sellOrder" },
            },
        });
        const filled = (22.5 * 24) / 3600;

        expect(catalog.journalFor("T4_MAIN_SWORD")).toBe(journal);
        expect(result.journal?.filled).toBeCloseTo(filled, 10);
        expect(result.journal?.profit).toBeCloseTo(filled * (5_000 * 0.935 - 1_000), 10);
    });

    it("leaves profit undefined when a price is missing", () => {
        const result = craft({
            ...base,
            resourcePrice: (id) => (id === "T4_LEATHER" ? 0 : 200),
        });

        expect(result.missingPrices).toEqual(["T4_LEATHER"]);
        expect(result.profit).toBeUndefined();
    });

    it("multiplies income by the amount crafted", () => {
        const stew = getItem(catalog, "T4_MEAL_STEW");
        const result = craft({
            ...base,
            item: stew,
            recipe: recipesOf(stew)[0]!,
            resourcePrice: () => 10,
            sale: { price: 100, kind: "buyOrder" },
        });

        expect(result.amountCrafted).toBe(10);
        expect(result.income).toBeCloseTo(100 * 0.96 * 10, 10);
    });

    it("never returns artifacts, hearts and royal sigils", () => {
        const scimitar = getItem(catalog, "T4_MAIN_SCIMITAR_MORGANA");
        const cape = getItem(catalog, "T6_CAPEITEM_DEMON");
        const royal = getItem(catalog, "T6_HEAD_PLATE_ROYAL");

        const returned = (uniqueName: string) =>
            craft({
                ...base,
                item: getItem(catalog, uniqueName),
                recipe: recipesOf(getItem(catalog, uniqueName))[0]!,
                resourcePrice: () => 100,
            }).resources.map((r) => [r.marketId, r.count, r.returned]);

        expect(returned(scimitar.uniqueName)).toEqual([
            ["T4_METALBAR", 16, true],
            ["T4_LEATHER", 8, true],
            ["T4_ARTEFACT_MAIN_SCIMITAR_MORGANA", 1, false],
        ]);
        // Capes are crafted from a ready cape, a crest and hearts
        expect(returned(cape.uniqueName)).toEqual([
            ["T6_CAPE", 1, false],
            ["T6_CAPEITEM_DEMON_BP", 1, false],
            ["T1_FACTION_STEPPE_TOKEN_1", 3, false],
        ]);
        // Royal items are upgraded from a regular item with sigils
        expect(returned(royal.uniqueName)).toEqual([
            ["T6_HEAD_PLATE_SET1", 1, false],
            ["QUESTITEM_TOKEN_ROYAL_T6", 8, false],
        ]);
    });

    it("prices enchanted items and resources by market id", () => {
        const result = craft({
            ...base,
            recipe: recipesOf(sword, 3)[0]!,
            resourcePrice: () => 100,
        });

        expect(itemMarketId(sword, 3)).toBe("T4_MAIN_SWORD@3");
        expect(result.resources.map((r) => r.marketId)).toEqual([
            "T4_METALBAR_LEVEL3@3",
            "T4_LEATHER_LEVEL3@3",
        ]);
    });
});
