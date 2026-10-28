/**
 * Refining of the old calculator, transcribed from albion-profit-calculator:
 * store/refining/getters.ts (returnPercentage), components/refining/getItemRecipe.ts
 * and components/refining/Table.vue (getRow, craftFee).
 */

const MARKET_SELL_ORDER_FEE = 6.5;

const materialValues = [
    [16, 32, 64, 128, 256],
    [32, 64, 128, 256, 512],
    [64, 128, 256, 512, 1024],
    [128, 256, 512, 1024, 2048],
    [256, 512, 1024, 2048, 4096],
];

const rawResources: Record<string, string> = {
    METALBAR: "ORE",
    LEATHER: "HIDE",
    CLOTH: "FIBER",
    PLANKS: "WOOD",
    STONEBLOCK: "ROCK",
};

export interface LegacyRefiningInput {
    /** METALBAR, LEATHER, CLOTH, PLANKS or STONEBLOCK */
    material: string;
    tier: number;
    subtier: number;
    city: string;
    useFocus: boolean;
    fee: number;
    price: (marketId: string) => number;
}

export interface LegacyRefiningRow {
    sell: number;
    rawResource: number;
    material: number;
    fee: number;
    profit: number;
    returnPercentage: number;
}

/** store/refining/getters.ts: returnPercentage */
export function legacyRefiningReturnPercentage(
    material: string,
    city: string,
    useFocus: boolean,
): number {
    let returnMaterialsPercentage = useFocus ? 43.5 : 15.2;

    const bonus: Record<string, string[]> = {
        Martlock: ["LEATHER"],
        Bridgewatch: ["STONEBLOCK"],
        Lymhurst: ["CLOTH"],
        "Fort Sterling": ["PLANKS"],
        Thetford: ["METALBAR"],
    };

    if (bonus[city]?.some((keyword) => material.includes(keyword))) {
        returnMaterialsPercentage = useFocus ? 53.9 : 36.7;
    }

    return returnMaterialsPercentage;
}

/** components/refining/Table.vue: getRow for one item */
export function legacyRefiningRow(input: LegacyRefiningInput): LegacyRefiningRow {
    const { material, tier, subtier, price } = input;
    const enchantment = subtier == 0 ? "" : `_LEVEL${subtier}@${subtier}`;
    const returnPercentage = legacyRefiningReturnPercentage(
        material,
        input.city,
        input.useFocus,
    );

    // getItemRecipe
    const rawResourceName = `T${tier}_${rawResources[material]}${enchantment}`;
    const rawResourceQuantity = Math.min(tier - 2, 5);
    const materialName = `T${tier - 1}_${material}` + (tier != 4 ? enchantment : "");

    const sell = Math.floor(
        price(`T${tier}_${material}${enchantment}`) * (1 - MARKET_SELL_ORDER_FEE / 100),
    );
    const rawResource = Math.floor(
        price(rawResourceName) * rawResourceQuantity * (1 - returnPercentage / 100),
    );
    const materialCost = Math.floor(
        price(materialName) * 1 * (1 - returnPercentage / 100),
    );
    const fee = Math.ceil(
        ((materialValues[subtier]![tier - 4]! * input.fee) / 100) * 0.1125,
    );

    return {
        sell,
        rawResource,
        material: materialCost,
        fee,
        profit: sell - (rawResource + materialCost + fee),
        returnPercentage,
    };
}
