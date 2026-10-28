import { describe, expect, it } from "vitest";
import {
    refinedItems,
    refining,
    refiningMarketIds,
    refiningRecipe,
} from "../src/refining.ts";
import { CLUSTERS, getItem, loadCatalog } from "./catalog.ts";

const catalog = loadCatalog();

describe("refinedItems", () => {
    it("lists every tier and enchantment level in order", () => {
        const bars = refinedItems(catalog, "METALBAR").map((item) => item.uniqueName);

        expect(bars).toHaveLength(27);
        expect(bars.slice(0, 5)).toEqual([
            "T2_METALBAR",
            "T3_METALBAR",
            "T4_METALBAR",
            "T4_METALBAR_LEVEL1",
            "T4_METALBAR_LEVEL2",
        ]);
        expect(bars.at(-1)).toBe("T8_METALBAR_LEVEL4");
    });

    it("has no enchanted stone blocks", () => {
        expect(refinedItems(catalog, "STONEBLOCK")).toHaveLength(7);
    });
});

describe("refiningRecipe", () => {
    it("takes the plain recipe without faction tokens", () => {
        const recipe = refiningRecipe(getItem(catalog, "T4_METALBAR_LEVEL1"));

        expect(recipe?.craftResource.map((r) => [r.uniqueName, r.count])).toEqual([
            ["T4_ORE_LEVEL1", 2],
            ["T3_METALBAR", 1],
        ]);
    });
});

describe("refiningMarketIds", () => {
    it("prices enchanted resources with the @ suffix and skips faction tokens", () => {
        const ids = refiningMarketIds(catalog, "METALBAR");

        expect(ids).toContain("T4_METALBAR_LEVEL1@1");
        expect(ids).toContain("T4_ORE_LEVEL1@1");
        expect(ids).toContain("T2_ORE");
        expect(ids.some((id) => id.includes("FACTION"))).toBe(false);
    });
});

describe("refining", () => {
    const prices: Record<string, number> = {
        T4_METALBAR: 400,
        T4_ORE: 100,
        T3_METALBAR: 80,
    };
    const rows = refining({
        catalog,
        resource: "METALBAR",
        clusterId: CLUSTERS.Thetford,
        useFocus: false,
        feePer100Nutrition: 800,
        premium: true,
        resourcePrice: (id) => prices[id],
        sale: (id) => ({ price: prices[id], kind: "sellOrder" }),
    });
    const t4 = rows.find((row) => row.marketId === "T4_METALBAR")!;

    it("uses the refining specialization of the city", () => {
        expect(t4.returnRate).toBeCloseTo(1 - 1 / 1.58, 10);
    });

    it("matches the old calculator's formula without its rounding", () => {
        const rate = 1 - 1 / 1.58;
        // 4% tax with premium + 2.5% setup fee
        const income = 400 * (1 - 0.065);
        const resources = (100 * 2 + 80) * (1 - rate);
        // item value 16 × 0.1125 nutrition per value × 800 per 100 nutrition
        const fee = (16 * 0.1125 * 800) / 100;

        expect(t4.result.profit).toBeCloseTo(income - resources - fee, 10);
    });

    it("leaves the profit undefined without prices", () => {
        const t5 = rows.find((row) => row.marketId === "T5_METALBAR")!;

        expect(t5.result.profit).toBeUndefined();
        expect(t5.result.missingPrices).toContain("T5_ORE");
    });

    it("takes a custom return rate", () => {
        const [row] = refining({
            catalog,
            resource: "PLANKS",
            useFocus: true,
            returnRate: 0.5,
            feePer100Nutrition: 0,
            premium: true,
            resourcePrice: () => 1,
            sale: () => ({ price: 1, kind: "sellOrder" }),
        });

        expect(row?.returnRate).toBe(0.5);
    });
});
