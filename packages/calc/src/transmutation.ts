import type { CraftingRequirement, Item } from "@apc/game-data";
import { type Catalog, craftItemValue } from "./catalog.ts";
import { stationFee } from "./stationFee.ts";

const TRANSMUTE_BUTTON = "@CRAFTBUILDING_ITEM_DETAILS_BUTTON_TRANSMUTE";

export function isTransmutation(recipe: CraftingRequirement): boolean {
    return recipe.craftButtonLocaOverride === TRANSMUTE_BUTTON;
}

/** Transmutation recipes of an item: from the previous tier or the previous enchantment */
export function transmutationRecipes(item: Item): CraftingRequirement[] {
    return item.craftingRequirements.filter(isTransmutation);
}

/** Silver and station fee of one transmutation */
export function transmutationCost(
    catalog: Catalog,
    item: Item,
    recipe: CraftingRequirement,
    options: { silverFactor: number; feePer100Nutrition: number },
): number {
    const itemValue = craftItemValue(item, recipe, catalog);
    const fee = stationFee(
        itemValue,
        options.feePer100Nutrition,
        catalog.constants.itemValueToNutrition,
    );

    return (recipe.silver ?? 0) * options.silverFactor + fee;
}

/**
 * Silver factor from a cost seen in the game: (cost − station fee) / recipe silver.
 * The game discounts transmutation silver globally, and the dumps don't have the discount.
 */
export function calibrateSilverFactor(
    catalog: Catalog,
    item: Item,
    recipe: CraftingRequirement,
    options: { observedCost: number; feePer100Nutrition: number },
): number {
    const fee = transmutationCost(catalog, item, recipe, {
        silverFactor: 0,
        feePer100Nutrition: options.feePer100Nutrition,
    });

    return (options.observedCost - fee) / (recipe.silver ?? 0);
}

export interface TransmutationStep {
    /** Transmuted resource */
    from: string;
    /** Result */
    to: string;
    recipe: CraftingRequirement;
    cost: number;
}

export interface TransmutationPath {
    steps: TransmutationStep[];
    /** Silver and station fees of all steps */
    cost: number;
}

/**
 * Cheapest chains of transmutations from an item to every item reachable from it,
 * a shortest path search over the transmutation recipes of the catalog
 */
export function cheapestTransmutations(
    catalog: Catalog,
    from: string,
    options: { silverFactor: number; feePer100Nutrition: number },
): Map<string, TransmutationPath> {
    const edges = new Map<string, TransmutationStep[]>();

    for (const item of catalog.items) {
        for (const recipe of transmutationRecipes(item)) {
            const [source] = recipe.craftResource;

            if (!source || recipe.craftResource.length !== 1) {
                continue;
            }

            const step: TransmutationStep = {
                from: source.uniqueName,
                to: item.uniqueName,
                recipe,
                cost: transmutationCost(catalog, item, recipe, options) * source.count,
            };

            edges.set(source.uniqueName, [...(edges.get(source.uniqueName) ?? []), step]);
        }
    }

    const paths = new Map<string, TransmutationPath>([[from, { steps: [], cost: 0 }]]);
    const done = new Set<string>();

    for (;;) {
        let current: [string, TransmutationPath] | undefined;

        for (const entry of paths) {
            if (!done.has(entry[0]) && (!current || entry[1].cost < current[1].cost)) {
                current = entry;
            }
        }

        if (!current) {
            break;
        }

        const [name, path] = current;

        done.add(name);

        for (const step of edges.get(name) ?? []) {
            const cost = path.cost + step.cost;
            const known = paths.get(step.to);

            if (!known || cost < known.cost) {
                paths.set(step.to, { steps: [...path.steps, step], cost });
            }
        }
    }

    paths.delete(from);

    return paths;
}
