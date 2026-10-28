/**
 * Food and potions of the old calculator, transcribed from albion-profit-calculator:
 * store/food-and-potions/getters.ts (getReturnPercentage, getResourceValueByName) and
 * components/food-and-potions/ItemCells/ItemCell.vue (item). The old calculator read
 * recipes from the dumps too, so recipes come from the catalog here.
 */
import type { CraftResource } from "@apc/game-data";

const MARKET_SELL_ORDER_FEE = 6.5;

export interface LegacyFoodInput {
    /** Market id of the crafted item, e.g. T4_MEAL_STEW@1 */
    itemName: string;
    amountCrafted: number;
    /** Resources with market ids, as the old dumps had them */
    resources: { marketId: string; resource: CraftResource }[];
    city: string;
    useFocus: boolean;
    fee: number;
    price: (marketId: string) => number;
}

export interface LegacyFoodCell {
    sell: number;
    resources: number;
    itemValue: number;
    fee: number;
    profit: number;
    returnPercentage: number;
}

/** store/food-and-potions/getters.ts: getReturnPercentage */
export function legacyFoodReturnPercentage(
    itemName: string,
    city: string,
    useFocus: boolean,
): number {
    let returnMaterialsPercentage = useFocus ? 43.5 : 15.2;

    if (itemName.includes("POTION") && city === "Brecilien") {
        returnMaterialsPercentage = useFocus ? 47.9 : 24.8;
    } else if (itemName.includes("MEAL") && city === "Caerleon") {
        returnMaterialsPercentage = useFocus ? 47.9 : 24.8;
    }

    return returnMaterialsPercentage;
}

/** store/food-and-potions/getters.ts: getResourceValueByName */
export function legacyResourceValue(resourceName: string): number {
    if (resourceName.includes("QUESTITEM_TOKEN_AVALON")) {
        return 64;
    }

    if (resourceName.includes("FISH")) {
        return 0;
    }

    return 40;
}

/** components/food-and-potions/ItemCells/ItemCell.vue: item */
export function legacyFoodCell(input: LegacyFoodInput): LegacyFoodCell {
    const returnPercentage = legacyFoodReturnPercentage(
        input.itemName,
        input.city,
        input.useFocus,
    );
    const sell =
        (input.amountCrafted *
            input.price(input.itemName) *
            (100 - MARKET_SELL_ORDER_FEE)) /
        100;

    let resources = 0;
    let itemValue = 0;

    for (const { marketId, resource } of input.resources) {
        const returnPercentageForResource = marketId.includes("QUESTITEM_TOKEN_AVALON")
            ? 0
            : returnPercentage;

        resources +=
            ((input.price(marketId) * (100 - returnPercentageForResource)) / 100) *
            resource.count;
        itemValue += legacyResourceValue(marketId) * resource.count;
    }

    const fee = ((itemValue * input.fee) / 100) * 0.1125;

    return {
        sell,
        resources,
        itemValue,
        fee,
        profit: Math.floor(sell - (resources + fee)),
        returnPercentage,
    };
}
