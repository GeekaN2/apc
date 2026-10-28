import type { CraftResource, CraftingRequirement, Item } from "@apc/game-data";
import {
    type Catalog,
    craftFame,
    craftItemValue,
    isReturned,
    resourceMarketId,
} from "./catalog.ts";
import { type Sale, hasPrice, saleIncome } from "./market.ts";
import { stationFee } from "./stationFee.ts";

export interface JournalInput {
    /** `journalitem` filled by the crafted item */
    journal: Item;
    /** Price of an empty journal per unit */
    emptyPrice?: number;
    fullSale: Sale;
}

export interface CraftInput {
    catalog: Catalog;
    /** Crafted item */
    item: Item;
    /** Recipe variant to craft, see `recipesOf` */
    recipe: CraftingRequirement;
    /** Price per unit to buy a resource, by market id */
    resourcePrice: (marketId: string) => number | undefined;
    /** How a crafted item is sold */
    sale: Sale;
    /** Share of returnable resources given back, see `returnRate` */
    returnRate: number;
    feePer100Nutrition: number;
    /** Number of crafts */
    crafts?: number;
    premium?: boolean;
    journal?: JournalInput;
}

export interface ResourceLine {
    resource: CraftResource;
    marketId: string;
    /** Units used by all crafts before the return */
    count: number;
    unitPrice?: number;
    returned: boolean;
    /** Expected cost after the return */
    cost?: number;
}

export interface JournalLine {
    marketId: string;
    filled: number;
    profit?: number;
}

/** Per all crafts. Money values are not rounded. */
export interface CraftResult {
    amountCrafted: number;
    income?: number;
    resources: ResourceLine[];
    itemValue: number;
    stationFee: number;
    journal?: JournalLine;
    cost?: number;
    profit?: number;
    profitPercentage?: number;
    /** Market ids without a price; profit is undefined when it's not empty */
    missingPrices: string[];
}

function journalLine(
    input: JournalInput,
    fame: number,
    premium: boolean,
    missing: string[],
): JournalLine {
    const marketId = `${input.journal.uniqueName}_FULL`;
    const filled = input.journal.maxFame ? fame / input.journal.maxFame : 0;
    const { emptyPrice, fullSale } = input;

    if (!hasPrice(emptyPrice)) {
        missing.push(`${input.journal.uniqueName}_EMPTY`);
    }

    if (!hasPrice(fullSale.price)) {
        missing.push(marketId);
    }

    if (!hasPrice(emptyPrice) || !hasPrice(fullSale.price)) {
        return { marketId, filled };
    }

    return {
        marketId,
        filled,
        profit:
            filled * (saleIncome(fullSale.price, fullSale.kind, premium) - emptyPrice),
    };
}

/** Profit of crafting an item by a recipe variant */
export function craft(input: CraftInput): CraftResult {
    const { catalog, recipe, returnRate, sale, crafts = 1, premium = true } = input;
    const missingPrices: string[] = [];
    const amountCrafted = (recipe.amountCrafted ?? 1) * crafts;

    const resources = recipe.craftResource.map((resource): ResourceLine => {
        const marketId = resourceMarketId(resource);
        const unitPrice = input.resourcePrice(marketId);
        const returned = isReturned(resource);
        const count = resource.count * crafts;

        if (!hasPrice(unitPrice)) {
            missingPrices.push(marketId);

            return { resource, marketId, count, returned };
        }

        return {
            resource,
            marketId,
            count,
            unitPrice,
            returned,
            cost: unitPrice * count * (returned ? 1 - returnRate : 1),
        };
    });

    const itemValue = craftItemValue(input.item, recipe, catalog);
    const fee = stationFee(itemValue, input.feePer100Nutrition) * crafts;
    const journal =
        input.journal &&
        journalLine(
            input.journal,
            craftFame(recipe, catalog) * crafts,
            premium,
            missingPrices,
        );

    let income: number | undefined;

    if (hasPrice(sale.price)) {
        income = saleIncome(sale.price, sale.kind, premium) * amountCrafted;
    } else {
        missingPrices.push("item");
    }

    const result: CraftResult = {
        amountCrafted,
        income,
        resources,
        itemValue,
        stationFee: fee,
        journal,
        missingPrices,
    };

    if (missingPrices.length > 0 || income === undefined) {
        return result;
    }

    const cost = resources.reduce((sum, line) => sum + (line.cost ?? 0), 0) + fee;
    const profit = income - cost + (journal?.profit ?? 0);

    return { ...result, cost, profit, profitPercentage: (profit / cost) * 100 };
}
