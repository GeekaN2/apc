import type {
    CraftResource,
    CraftingModifiers,
    CraftingRequirement,
    Item,
} from "@apc/game-data";

/** Lookup over the game-data catalog */
export interface Catalog {
    item(uniqueName: string): Item | undefined;
    /** Journal filled by crafting the item, from `famefillingmissions.craftitemfame` */
    journalFor(uniqueName: string): Item | undefined;
    modifiers: CraftingModifiers;
}

export function createCatalog(items: Item[], modifiers: CraftingModifiers): Catalog {
    const byName = new Map(items.map((item) => [item.uniqueName, item]));
    const journals = new Map<string, Item>();

    for (const item of items) {
        for (const validItem of item.fameFillingMissions?.craftItemFame?.validItem ??
            []) {
            journals.set(validItem, item);
        }
    }

    return {
        item: (uniqueName) => byName.get(uniqueName),
        journalFor: (uniqueName) => journals.get(uniqueName),
        modifiers,
    };
}

/** Enchanted resources are traded with an `@N` suffix: `T4_METALBAR_LEVEL1@1` */
export function resourceMarketId(resource: CraftResource): string {
    return resource.enchantmentLevel
        ? `${resource.uniqueName}@${resource.enchantmentLevel}`
        : resource.uniqueName;
}

/** Market id of an item at an enchantment level nested in it */
export function itemMarketId(item: Item, enchantmentLevel = 0): string {
    if (item.enchantmentLevel) {
        return `${item.uniqueName}@${item.enchantmentLevel}`;
    }

    return enchantmentLevel ? `${item.uniqueName}@${enchantmentLevel}` : item.uniqueName;
}

/**
 * Recipe variants of an item. Equipment and consumables keep enchanted recipes
 * in `enchantments`; enchanted resources are separate items with their own recipes.
 */
export function recipesOf(item: Item, enchantmentLevel = 0): CraftingRequirement[] {
    if (enchantmentLevel === 0 || item.enchantmentLevel !== undefined) {
        return item.craftingRequirements;
    }

    return (
        item.enchantments.find((e) => e.enchantmentLevel === enchantmentLevel)
            ?.craftingRequirements ?? []
    );
}

function recipeItemValue(
    recipe: CraftingRequirement,
    catalog: Catalog,
    visited: Set<string>,
): number {
    const sum = recipe.craftResource.reduce((total, r) => {
        const resource = catalog.item(r.uniqueName);

        return total + (resource ? itemValueOf(resource, catalog, visited) : 0) * r.count;
    }, 0);

    return sum / (recipe.amountCrafted ?? 1);
}

/**
 * Item value of one item: its own `itemValue` (raw and refined resources have it),
 * otherwise the value of its first recipe, e.g. bread → flour → wheat
 */
function itemValueOf(item: Item, catalog: Catalog, visited: Set<string>): number {
    const recipe = item.craftingRequirements[0];

    if (item.itemValue !== undefined) {
        return item.itemValue;
    }

    if (!recipe || visited.has(item.uniqueName)) {
        return 0;
    }

    return recipeItemValue(recipe, catalog, new Set(visited).add(item.uniqueName));
}

/** Item value of a craft, used for the station fee */
export function craftItemValue(
    item: Item,
    recipe: CraftingRequirement,
    catalog: Catalog,
): number {
    if (item.itemValue !== undefined) {
        return item.itemValue;
    }

    return (
        recipeItemValue(recipe, catalog, new Set([item.uniqueName])) *
        (recipe.amountCrafted ?? 1)
    );
}

/**
 * Crafting fame per unit of a refined resource by tier, doubled by each enchantment level.
 * Not in ao-bin-dumps; the values come from the old calculator.
 */
export const CRAFT_FAME_PER_RESOURCE: Readonly<Record<number, number>> = {
    4: 22.5,
    5: 90,
    6: 270,
    7: 645,
    8: 1395,
};

/** Fame of a craft from its refined resources; it fills journals */
export function craftFame(recipe: CraftingRequirement, catalog: Catalog): number {
    return recipe.craftResource.reduce((sum, r) => {
        const resource = catalog.item(r.uniqueName);

        if (resource?.shopSubcategory1 !== "refinedresources") {
            return sum;
        }

        const fame = CRAFT_FAME_PER_RESOURCE[resource.tier] ?? 0;

        return sum + fame * 2 ** (resource.enchantmentLevel ?? 0) * r.count;
    }, 0);
}

/** `maxreturnamount="0"` marks resources that the return rate never gives back */
export function isReturned(resource: CraftResource): boolean {
    return resource.maxReturnAmount !== 0;
}
