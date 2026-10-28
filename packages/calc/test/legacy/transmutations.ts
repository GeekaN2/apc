/**
 * Transmutations of the old calculator, transcribed from albion-profit-calculator:
 * store/transmutations/getters.ts (globalDiscount) and components/transmutations/Table.vue
 * (values, cost tables, getTransmutationFee, getRowFirst, getRowSecond,
 * getAllTransmuteWays). Hardcoded tables are kept as they were.
 */

const MARKET_SELL_ORDER_FEE = 6.5;

/** Item values of raw resources by [subtier][tier - 4] */
export const LEGACY_VALUES = [
    [4, 5.34, 8, 12.8, 25.6],
    [12, 10.66, 16, 25.6, 51.2],
    [28, 21.34, 32, 51.2, 102.4],
    [60, 42.66, 64, 102.4, 204.8],
    [124, 85.32, 128, 204.8, 409.6],
];

/** Silver to transmute from the previous subtier of the same tier */
export const LEGACY_PREV_SUBTIER_COST = [
    [0, 0, 0, 0, 0],
    [1500, 2000, 3000, 4800, 14400],
    [3000, 4000, 6000, 15120, 45360],
    [6000, 8000, 19800, 49896, 149688],
    [24000, 32000, 79200, 199584, 748440],
];

/** Silver to transmute from the previous tier of the same subtier */
export const LEGACY_PREV_TIER_COST = [
    [0, 781, 1250, 2500, 5000],
    [0, 1563, 2500, 5000, 15000],
    [0, 3125, 5000, 15750, 47250],
    [0, 6250, 16500, 51975, 155925],
    [0, 25000, 66000, 207900, 779625],
];

/** Rocks only had the previous tier recipe */
export const LEGACY_ROCK_COST = [0, 1070, 2400, 5120, 12800];

export type LegacyFormula = "prevTier" | "prevSubtier";

/** store/transmutations/getters.ts: globalDiscount from the T4.3 → T4.4 cost in the game */
export function legacyGlobalDiscount(gameItemFee: number, fee: number): number {
    const itemTransCost = 24000;
    const itemValue = 124;

    return (gameItemFee - ((itemValue * fee) / 100) * 0.1125) / itemTransCost;
}

export function legacyItemName(resource: string, tier: number, subtier: number): string {
    return `T${tier}_${resource}` + (subtier == 0 ? "" : `_LEVEL${subtier}@${subtier}`);
}

/** Table.vue: getTransmutationFee */
export function legacyTransmutationFee(
    resource: string,
    tier: number,
    subtier: number,
    formula: LegacyFormula,
    fee: number,
    globalDiscount: number,
): number {
    let itemTransCost = LEGACY_PREV_SUBTIER_COST[subtier]![tier - 4]!;

    if (formula === "prevTier") {
        itemTransCost =
            resource == "ROCK"
                ? LEGACY_ROCK_COST[tier - 4]!
                : LEGACY_PREV_TIER_COST[subtier]![tier - 4]!;
    }

    const value = LEGACY_VALUES[subtier]![tier - 4]!;

    return itemTransCost * globalDiscount + ((value * fee) / 100) * 0.1125;
}

export interface LegacyTransmutationRow {
    price: number;
    fee: number;
    materialName: string;
    profit: number;
}

/** Table.vue: getRowFirst (tier ≥ 5) and getRowSecond (subtier ≥ 1) for one cell */
export function legacyTransmutationRow(
    resource: string,
    tier: number,
    subtier: number,
    formula: LegacyFormula,
    fee: number,
    globalDiscount: number,
    price: (marketId: string) => number,
): LegacyTransmutationRow {
    const itemName = legacyItemName(resource, tier, subtier);
    const sellFee = formula === "prevTier" ? MARKET_SELL_ORDER_FEE / 100 : 0.045;
    const itemPrice = Math.floor(price(itemName) * (1 - sellFee));
    const transmutationFee = Math.floor(
        legacyTransmutationFee(resource, tier, subtier, formula, fee, globalDiscount),
    );
    const materialName =
        formula === "prevTier"
            ? legacyItemName(resource, tier - 1, subtier)
            : legacyItemName(resource, tier, subtier - 1);
    const outcome = transmutationFee + price(materialName);

    return {
        price: itemPrice,
        fee: transmutationFee,
        materialName,
        profit: itemPrice - outcome,
    };
}

/** Table.vue: getAllTransmuteWays, the cheapest fee from a start to every cell above it */
export function legacyAllWays(
    resource: string,
    tier: number,
    subtier: number,
    fee: number,
    globalDiscount: number,
): Map<string, number> {
    const cells: number[][] = [];
    const ways = new Map<string, number>();

    for (let t = tier; t <= 8; t++) {
        for (let s = subtier; s <= 4; s++) {
            (cells[s] ??= [])[t] = 0;

            if (t == tier && s == subtier) {
                continue;
            }

            let prevTierFee = 0;
            let prevSubtierFee = 0;

            if (t - 1 >= tier) {
                prevTierFee =
                    cells[s]![t - 1]! +
                    legacyTransmutationFee(
                        resource,
                        t,
                        s,
                        "prevTier",
                        fee,
                        globalDiscount,
                    );
            }

            if (s - 1 >= subtier) {
                prevSubtierFee =
                    cells[s - 1]![t]! +
                    legacyTransmutationFee(
                        resource,
                        t,
                        s,
                        "prevSubtier",
                        fee,
                        globalDiscount,
                    );
            }

            cells[s]![t] =
                (prevTierFee < prevSubtierFee && prevTierFee != 0) || prevSubtierFee == 0
                    ? prevTierFee
                    : prevSubtierFee;
            ways.set(legacyItemName(resource, t, s), cells[s]![t]!);
        }
    }

    return ways;
}
