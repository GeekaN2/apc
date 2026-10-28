import type {
    CraftResource,
    CraftingModifiers,
    CraftingRequirement,
    GameConstants,
    Item,
} from "@apc/game-data";

/** Lookup over the game-data catalog */
export interface Catalog {
    items: readonly Item[];
    item(uniqueName: string): Item | undefined;
    /** Journal filled by crafting the item, from `famefillingmissions.craftitemfame` */
    journalFor(uniqueName: string): Item | undefined;
    modifiers: CraftingModifiers;
    constants: GameConstants;
}

export function createCatalog(
    items: Item[],
    modifiers: CraftingModifiers,
    constants: GameConstants,
): Catalog {
    const byName = new Map(items.map((item) => [item.uniqueName, item]));
    const journals = new Map<string, Item>();

    for (const item of items) {
        for (const validItem of item.fameFillingMissions?.craftItemFame?.validItem ??
            []) {
            journals.set(validItem, item);
        }
    }

    return {
        items,
        item: (uniqueName) => byName.get(uniqueName),
        journalFor: (uniqueName) => journals.get(uniqueName),
        modifiers,
        constants,
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

/** Value of an item in the dumps, e.g. `itemValue` or `fameValue` */
type OwnValue = (item: Item) => number | undefined;

const ownItemValue: OwnValue = (item) => item.itemValue;
const ownFameValue: OwnValue = (item) => item.fameValue;

/** Value of one crafted unit by a recipe */
function recipeValue(
    recipe: CraftingRequirement,
    catalog: Catalog,
    own: OwnValue,
    visited: Set<string>,
): number {
    const sum = recipe.craftResource.reduce((total, r) => {
        const resource = catalog.item(r.uniqueName);

        return (
            total + (resource ? valueOf(resource, catalog, own, visited) : 0) * r.count
        );
    }, 0);

    return sum / (recipe.amountCrafted ?? 1);
}

/**
 * The item's own value from the dumps, otherwise the value of its first recipe,
 * e.g. bread → flour → wheat
 */
function valueOf(
    item: Item,
    catalog: Catalog,
    own: OwnValue,
    visited: Set<string>,
): number {
    const value = own(item);
    const recipe = item.craftingRequirements[0];

    if (value !== undefined) {
        return value;
    }

    if (!recipe || visited.has(item.uniqueName)) {
        return 0;
    }

    return recipeValue(recipe, catalog, own, new Set(visited).add(item.uniqueName));
}

/** Value of a whole craft: the product's own value or the sum over the recipe */
function craftValue(
    item: Item,
    recipe: CraftingRequirement,
    catalog: Catalog,
    own: OwnValue,
) {
    return (
        own(item) ??
        recipeValue(recipe, catalog, own, new Set([item.uniqueName])) *
            (recipe.amountCrafted ?? 1)
    );
}

/** Item value of a craft, used for the station fee */
export function craftItemValue(
    item: Item,
    recipe: CraftingRequirement,
    catalog: Catalog,
): number {
    return craftValue(item, recipe, catalog, ownItemValue);
}

/**
 * Fame of a craft that fills journals: resources' `fameValue` (raw resources have it),
 * refined resources get the fame of their recipe, e.g. T5 bar = 3 × T5 ore + T4 bar
 */
export function craftFame(
    item: Item,
    recipe: CraftingRequirement,
    catalog: Catalog,
): number {
    const fame =
        recipeValue(recipe, catalog, ownFameValue, new Set([item.uniqueName])) *
        (recipe.amountCrafted ?? 1);

    return fame * catalog.constants.craftItemFameFactor;
}

/** `maxreturnamount="0"` marks resources that the return rate never gives back */
export function isReturned(resource: CraftResource): boolean {
    return resource.maxReturnAmount !== 0;
}
