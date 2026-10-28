/**
 * Profit tree of the old calculator, transcribed from albion-profit-calculator:
 * store/profit-tree/getters.ts (returnMaterialPercentage) and
 * components/tree/ItemTable.vue (getRow, itemCreationCost, getArtefactPrice, craftFee,
 * journalProfit). Hardcoded tables are kept as they were, including their typos.
 * Only regular and artifact items: royal items and capes used recipes that no longer
 * match the game.
 */

const MARKET_SELL_ORDER_FEE = 6.5;

const materialsBaseFame: Record<number, number> = {
    4: 22.5,
    5: 90,
    6: 270,
    7: 645,
    8: 1395,
};

export const LEGACY_ITEM_VALUES = [
    [16, 32, 64, 128, 256],
    [32, 62, 128, 256, 512],
    [64, 128, 256, 512, 1024],
    [128, 256, 512, 1024, 2048],
    [256, 512, 1024, 2056, 4096],
];

const itemAndArtefactValues: Record<string, number> = {
    T4_rune: 4,
    T4_soul: 12,
    T4_relic: 28,
    T4_avalon: 60,
    T5_rune: 8,
    T5_soul: 24,
    T5_relic: 56,
    T5_avalon: 119.5,
    T6_rune: 16,
    T6_soul: 48,
    T6_relic: 111.5,
    T6_avalon: 240,
    T7_rune: 32,
    T7_soul: 95.5,
    T7_relic: 222.5,
    T7_avalon: 480,
    T8_rune: 63.5,
    T8_soul: 190.5,
    T8_relic: 444.5,
    T8_avalon: 952.5,
};

const journalFames = [3600, 7200, 14400, 28380, 58590];

export interface LegacyTreeInput {
    /** T4 name, e.g. T4_MAIN_SWORD */
    name: string;
    /** Parent node in profitTreeItemsTree.json */
    parent: string;
    /** ROOT_WARRIOR etc. */
    root: string;
    artefactLevel: "" | "rune" | "soul" | "relic" | "avalon";
    /** From profitTreeRecipes.json, e.g. { METALBAR: 16, LEATHER: 8 } */
    recipe: Record<string, number>;
    tier: number;
    subtier: number;
    city: string;
    useFocus: boolean;
    craftFee: number;
    useJournals: boolean;
    itemsMultiplier: number;
    price: (marketId: string) => number;
    /** Overrides LEGACY_ITEM_VALUES to check everything but the typos */
    itemValues?: number[][];
}

export interface LegacyTreeRow {
    sell: number;
    resources: number;
    artefact: number;
    fee: number;
    journals: number;
    profit: number;
    returnPercentage: number;
}

/** store/profit-tree/getters.ts: returnMaterialPercentage */
export function legacyReturnMaterialPercentage(
    city: string,
    parentItem: string,
    itemName: string,
    useFocus: boolean,
): number {
    let returnMaterialsPercentage = useFocus ? 43.5 : 15.2;

    const bonus: Record<string, string[]> = {
        Caerleon: ["TOOL", "KNUCKLES"],
        Martlock: ["AXE", "QUARTERSTAFF", "FROSTSTAFF", "SHOES_PLATE", "OFF"],
        Bridgewatch: ["CROSSBOW", "DAGGER", "CURSEDSTAFF", "ARMOR_PLATE", "SHOES_CLOTH"],
        Lymhurst: ["SWORD", "BOW", "ARCANESTAFF", "HEAD_LEATHER", "SHOES_LEATHER"],
        "Fort Sterling": ["HAMMER", "SPEAR", "HOLYSTAFF", "HEAD_PLATE", "ARMOR_CLOTH"],
        Thetford: ["MACE", "NATURESTAFF", "FIRESTAFF", "ARMOR_LEATHER", "HEAD_CLOTH"],
        Brecilien: ["CAPE", "BAG"],
    };

    const categories = bonus[city];

    if (!categories) {
        return returnMaterialsPercentage;
    }

    let addBonus = categories.some((keyword) => parentItem.includes(keyword));

    if (city == "Caerleon") {
        addBonus = categories.some((keyword) => itemName.includes(keyword));
    }

    if (addBonus) {
        returnMaterialsPercentage = useFocus ? 47.9 : 24.8;
    }

    return returnMaterialsPercentage;
}

/** components/tree/ItemTable.vue: getRow for one item */
export function legacyTreeRow(input: LegacyTreeInput): LegacyTreeRow {
    const { tier, subtier, recipe, itemsMultiplier, price } = input;
    const itemName = `T${tier}${input.name.slice(2)}` + (subtier ? `@${subtier}` : "");
    const amountOfMaterials = Object.values(recipe).reduce((sum, n) => sum + n, 0);
    const returnPercentage = legacyReturnMaterialPercentage(
        input.city,
        input.parent,
        input.name,
        input.useFocus,
    );

    // getRow
    const sell =
        Math.floor(Math.floor(price(itemName)) * (1 - MARKET_SELL_ORDER_FEE / 100)) *
        itemsMultiplier;

    // itemCreationCost
    let resources = 0;

    for (const [resourceName, amount] of Object.entries(recipe)) {
        const resourceFullName =
            `T${tier}_${resourceName}` +
            (subtier != 0 ? `_LEVEL${subtier}@${subtier}` : "");

        resources += Math.floor(
            price(resourceFullName) *
                amount *
                (1 - returnPercentage / 100) *
                itemsMultiplier,
        );
    }

    // getArtefactPrice, regular artifacts only
    const artefact = input.artefactLevel
        ? price(`T${tier}_ARTEFACT${input.name.slice(2)}`) * itemsMultiplier
        : 0;

    // craftFee
    let itemValue = (input.itemValues ?? LEGACY_ITEM_VALUES)[subtier]![tier - 4]!;

    if (input.artefactLevel.length != 0) {
        itemValue += itemAndArtefactValues[`T${tier}_${input.artefactLevel}`] || 0;
    }

    const fee = Math.floor(
        ((itemValue * amountOfMaterials * input.craftFee) / 100) *
            0.1125 *
            itemsMultiplier,
    );

    // journalProfit
    let journals = 0;

    if (input.useJournals) {
        const craftFame = materialsBaseFame[tier]! * 2 ** subtier * amountOfMaterials;
        const journalFame = journalFames[tier - 4]!;
        const journalName = `T${tier}_JOURNAL${input.root.slice(4)}`;
        const emptyPrice = price(`${journalName}_EMPTY`);
        const fullPrice = price(`${journalName}_FULL`);

        journals = Math.floor(
            (fullPrice - emptyPrice) *
                (craftFame / journalFame) *
                (1 - MARKET_SELL_ORDER_FEE / 100) *
                itemsMultiplier,
        );
    }

    const creationCost = resources + artefact + fee;

    return {
        sell,
        resources,
        artefact,
        fee,
        journals,
        profit: sell - creationCost + journals,
        returnPercentage,
    };
}
