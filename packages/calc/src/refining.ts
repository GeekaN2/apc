import type { CraftingRequirement, Item } from "@apc/game-data";
import { type Catalog, itemMarketId, resourceMarketId } from "./catalog.ts";
import { type CraftResult, craft } from "./craft.ts";
import type { Sale } from "./market.ts";
import { productionBonus, returnRate } from "./returnRate.ts";

/** Refined resources and the raw resources they are refined from */
export const REFINED_RESOURCES = {
    METALBAR: "ORE",
    PLANKS: "WOOD",
    LEATHER: "HIDE",
    CLOTH: "FIBER",
    STONEBLOCK: "ROCK",
} as const;

export type RefinedResource = keyof typeof REFINED_RESOURCES;

/** `T5_METALBAR`, `T5_METALBAR_LEVEL2` */
function isOfResource(item: Item, resource: RefinedResource): boolean {
    return new RegExp(`^T\\d_${resource}(_LEVEL\\d)?$`).test(item.uniqueName);
}

/** Refined resources of a kind by tier, then enchantment level */
export function refinedItems(catalog: Catalog, resource: RefinedResource): Item[] {
    return catalog.items
        .filter(
            (item) =>
                item.shopSubcategory1 === "refinedresources" &&
                isOfResource(item, resource),
        )
        .sort(
            (a, b) =>
                a.tier - b.tier || (a.enchantmentLevel ?? 0) - (b.enchantmentLevel ?? 0),
        );
}

/**
 * The plain refining recipe. The dumps list it first; the other variants take
 * faction tokens or, for stone blocks, enchanted rock.
 */
export function refiningRecipe(item: Item): CraftingRequirement | undefined {
    return item.craftingRequirements[0];
}

/** Market ids to price: refined resources and everything their recipes take */
export function refiningMarketIds(catalog: Catalog, resource: RefinedResource): string[] {
    const ids = new Set<string>();

    for (const item of refinedItems(catalog, resource)) {
        ids.add(itemMarketId(item));

        for (const r of refiningRecipe(item)?.craftResource ?? []) {
            ids.add(resourceMarketId(r));
        }
    }

    return [...ids];
}

export interface RefiningOptions {
    catalog: Catalog;
    resource: RefinedResource;
    /** Cluster of the refining city from `craftingmodifiers.json`; none means no city bonus */
    clusterId?: string;
    useFocus: boolean;
    /** Share of resources given back, instead of the one from the city and focus */
    returnRate?: number;
    feePer100Nutrition: number;
    premium: boolean;
    /** Price per unit to buy a resource, by market id */
    resourcePrice: (marketId: string) => number | undefined;
    /** How a refined resource is sold, by market id */
    sale: (marketId: string) => Sale;
}

export interface RefiningRow {
    item: Item;
    marketId: string;
    tier: number;
    enchantmentLevel: number;
    returnRate: number;
    /** Focus spent per craft without focus efficiency */
    focus?: number;
    /** One craft: one refined resource */
    result: CraftResult;
}

/** Profit of refining every tier and enchantment level of a resource */
export function refining(options: RefiningOptions): RefiningRow[] {
    const { catalog, clusterId, useFocus } = options;

    return refinedItems(catalog, options.resource).flatMap((item) => {
        const recipe = refiningRecipe(item);

        if (!recipe) {
            return [];
        }

        const marketId = itemMarketId(item);
        const rate =
            options.returnRate ??
            returnRate(productionBonus({ catalog, item, clusterId, useFocus }));

        return {
            item,
            marketId,
            tier: item.tier,
            enchantmentLevel: item.enchantmentLevel ?? 0,
            returnRate: rate,
            focus: recipe.craftingFocus,
            result: craft({
                catalog,
                item,
                recipe,
                resourcePrice: options.resourcePrice,
                sale: options.sale(marketId),
                returnRate: rate,
                feePer100Nutrition: options.feePer100Nutrition,
                premium: options.premium,
            }),
        };
    });
}
