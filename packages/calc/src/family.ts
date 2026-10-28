import type { CraftingRequirement, Item } from "@apc/game-data";
import { type Catalog, itemMarketId, recipesOf, resourceMarketId } from "./catalog.ts";
import { type CraftResult, type JournalInput, craft } from "./craft.ts";
import type { Sale } from "./market.ts";
import { productionBonus, returnRate } from "./returnRate.ts";

/** Marketplace categories of crafted equipment that fills journals */
export const EQUIPMENT_CATEGORIES = [
    "weapons",
    "armors",
    "head",
    "shoes",
    "offhands",
    "capes",
    "bags",
    "gathering",
] as const;

/** One item in every tier: `T4_MAIN_SWORD` … `T8_MAIN_SWORD` */
export interface ItemFamily {
    /** Unique name without the tier: `MAIN_SWORD` */
    key: string;
    shopCategory: string;
    shopSubcategory1: string;
    shopSubcategory2?: string;
    /** By tier */
    items: Item[];
}

const TIER_PREFIX = /^T(\d)_/;

export function familyKey(item: Item): string {
    return item.uniqueName.replace(TIER_PREFIX, "");
}

/** Families of craftable items in the given marketplace categories */
export function craftableFamilies(
    catalog: Catalog,
    shopCategories: readonly string[],
): ItemFamily[] {
    const families = new Map<string, ItemFamily>();

    for (const item of catalog.items) {
        if (
            !shopCategories.includes(item.shopCategory) ||
            !TIER_PREFIX.test(item.uniqueName) ||
            item.craftingRequirements.length === 0
        ) {
            continue;
        }

        const key = familyKey(item);
        const family = families.get(key) ?? {
            key,
            shopCategory: item.shopCategory,
            shopSubcategory1: item.shopSubcategory1,
            shopSubcategory2: item.shopSubcategory2,
            items: [],
        };

        family.items.push(item);
        families.set(key, family);
    }

    for (const family of families.values()) {
        family.items.sort((a, b) => a.tier - b.tier);
    }

    return [...families.values()];
}

/** Enchantment levels the item can be crafted at: 0 and the nested ones */
export function enchantmentLevels(item: Item): number[] {
    return [
        0,
        ...item.enchantments
            .filter((e) => e.craftingRequirements.length > 0)
            .map((e) => e.enchantmentLevel),
    ];
}

/**
 * The most recipe variants an item of the family has, e.g. an Avalonian weapon
 * with its artifact or with an Avalonian energy token
 */
export function recipeVariantCount(family: ItemFamily): number {
    return Math.max(...family.items.map((item) => item.craftingRequirements.length));
}

/** Recipe variant of an item at a level; items with fewer variants use their last one */
export function familyRecipe(
    item: Item,
    enchantmentLevel: number,
    variant: number,
): CraftingRequirement | undefined {
    const recipes = recipesOf(item, enchantmentLevel);

    return recipes[Math.min(variant, recipes.length - 1)];
}

/** Market ids to price: products at every level, their resources and journals */
export function familyMarketIds(
    catalog: Catalog,
    family: ItemFamily,
    variant: number,
): string[] {
    const ids = new Set<string>();

    for (const item of family.items) {
        const journal = catalog.journalFor(item.uniqueName);

        if (journal) {
            ids.add(`${journal.uniqueName}_EMPTY`);
            ids.add(`${journal.uniqueName}_FULL`);
        }

        for (const level of enchantmentLevels(item)) {
            ids.add(itemMarketId(item, level));

            for (const r of familyRecipe(item, level, variant)?.craftResource ?? []) {
                ids.add(resourceMarketId(r));
            }
        }
    }

    return [...ids];
}

export interface FamilyCraftOptions {
    catalog: Catalog;
    family: ItemFamily;
    /** Recipe variant, see `recipeVariantCount` */
    variant: number;
    /** Cluster of the crafting city from `craftingmodifiers.json`; none means no city bonus */
    clusterId?: string;
    useFocus: boolean;
    /** Share of resources given back, instead of the one from the city and focus */
    returnRate?: number;
    feePer100Nutrition: number;
    premium: boolean;
    crafts: number;
    /** Price per unit to buy a resource, by market id */
    resourcePrice: (marketId: string) => number | undefined;
    /** How a crafted item is sold, by market id */
    sale: (marketId: string) => Sale;
    /** Journal prices; without it journals are not counted */
    journal?: (journal: Item) => Omit<JournalInput, "journal">;
}

export interface FamilyCell {
    item: Item;
    marketId: string;
    tier: number;
    enchantmentLevel: number;
    recipe: CraftingRequirement;
    returnRate: number;
    /** Focus per craft without focus efficiency */
    focus?: number;
    result: CraftResult;
}

/** Profit of crafting every tier and enchantment level of a family */
export function craftFamily(options: FamilyCraftOptions): FamilyCell[] {
    const { catalog, clusterId, useFocus } = options;

    return options.family.items.flatMap((item) => {
        const rate =
            options.returnRate ??
            returnRate(productionBonus({ catalog, item, clusterId, useFocus }));
        const journal = catalog.journalFor(item.uniqueName);

        return enchantmentLevels(item).flatMap((enchantmentLevel) => {
            const recipe = familyRecipe(item, enchantmentLevel, options.variant);

            if (!recipe) {
                return [];
            }

            const marketId = itemMarketId(item, enchantmentLevel);

            return {
                item,
                marketId,
                tier: item.tier,
                enchantmentLevel,
                recipe,
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
                    crafts: options.crafts,
                    journal:
                        journal && options.journal
                            ? { journal, ...options.journal(journal) }
                            : undefined,
                }),
            };
        });
    });
}
