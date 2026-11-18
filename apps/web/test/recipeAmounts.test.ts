import { expect, it } from "vitest";
import {
    formatRecipeAmount,
    summarizeRecipeAmounts,
} from "../src/catalog/recipeAmounts.ts";

it("shows exact totals and ranges across tiers and enchantment levels", () => {
    const amounts = summarizeRecipeAmounts([
        [
            { marketId: "T4_CLOTH", count: 6 },
            { marketId: "T4_CLOTH", count: 2 },
            { marketId: "QUESTITEM_TOKEN_ROYAL_T4", count: 1 },
        ],
        [
            { marketId: "T8_CLOTH_LEVEL2@2", count: 8 },
            { marketId: "QUESTITEM_TOKEN_ROYAL_T8", count: 10 },
        ],
        [{ marketId: "T5_CLOTH", count: 8 }],
    ]);

    expect(amounts.get("CLOTH")).toEqual({ marketId: "T4_CLOTH", min: 8, max: 8 });
    expect(amounts.get("QUESTITEM_TOKEN_ROYAL")).toEqual({
        marketId: "QUESTITEM_TOKEN_ROYAL_T4",
        min: 1,
        max: 10,
    });
    expect(formatRecipeAmount(amounts.get("CLOTH")!, "en")).toBe("8");
    expect(formatRecipeAmount(amounts.get("QUESTITEM_TOKEN_ROYAL")!, "en")).toBe("1–10");
});
