import type { CraftingRequirement, Item } from "@apc/game-data";
import { type Catalog, craftItemValue, itemMarketId } from "./catalog.ts";
import { type Sale, hasPrice, saleIncome } from "./market.ts";
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

type TransmutationGraph = ReadonlyMap<string, TransmutationStep[]>;

/** Transmutation steps out of every item */
function transmutationGraph(
    catalog: Catalog,
    options: { silverFactor: number; feePer100Nutrition: number },
): TransmutationGraph {
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

    return edges;
}

/** Shortest paths by cost from an item over the graph */
function cheapestPaths(edges: TransmutationGraph, from: string) {
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

/**
 * Cheapest chains of transmutations from an item to every item reachable from it,
 * a shortest path search over the transmutation recipes of the catalog
 */
export function cheapestTransmutations(
    catalog: Catalog,
    from: string,
    options: { silverFactor: number; feePer100Nutrition: number },
): Map<string, TransmutationPath> {
    return cheapestPaths(transmutationGraph(catalog, options), from);
}

/** `T5_ORE_LEVEL2`: raw resources of a kind that transmute into each other */
export function transmutableResources(catalog: Catalog, resource: string): Item[] {
    const pattern = new RegExp(`^T\\d_${resource}(_LEVEL\\d)?$`);

    return catalog.items
        .filter((item) => pattern.test(item.uniqueName))
        .sort(
            (a, b) =>
                a.tier - b.tier || (a.enchantmentLevel ?? 0) - (b.enchantmentLevel ?? 0),
        );
}

export interface TransmutationOffer {
    /** Bought item */
    source: Item;
    path: TransmutationPath;
    /** Price of the bought item */
    buy: number;
    /** Silver received for the result after the market fees */
    income: number;
    /** Price of the bought item and the transmutation costs */
    cost: number;
    profit: number;
    profitPercentage: number;
}

export interface TransmutationTarget {
    item: Item;
    /** The most profitable way to get the item, if any has prices */
    best?: TransmutationOffer;
    /** Ways to get the item at all, priced or not */
    ways: number;
}

/**
 * The most profitable way to get every resource of a kind: buy another one and
 * transmute it, in one step or a chain
 */
export function bestTransmutations(options: {
    catalog: Catalog;
    resource: string;
    silverFactor: number;
    feePer100Nutrition: number;
    premium: boolean;
    /** Price per unit to buy an item, by market id */
    buyPrice: (marketId: string) => number | undefined;
    /** How an item is sold, by market id */
    sale: (marketId: string) => Sale;
}): TransmutationTarget[] {
    const { catalog } = options;
    const items = transmutableResources(catalog, options.resource);
    const edges = transmutationGraph(catalog, options);
    const paths = items.map((source) => ({
        source,
        paths: cheapestPaths(edges, source.uniqueName),
    }));
    const { marketPlace } = catalog.constants;

    return items
        .filter((item) => transmutationRecipes(item).length > 0)
        .map((item) => {
            const sale = options.sale(itemMarketId(item));
            const income = hasPrice(sale.price)
                ? saleIncome(marketPlace, sale.price, sale.kind, options.premium)
                : undefined;
            let best: TransmutationOffer | undefined;
            let ways = 0;

            for (const { source, paths: from } of paths) {
                const path = from.get(item.uniqueName);

                if (!path) {
                    continue;
                }

                ways++;

                const buy = options.buyPrice(itemMarketId(source));

                if (income === undefined || !hasPrice(buy)) {
                    continue;
                }

                const cost = buy + path.cost;
                const profit = income - cost;

                if (!best || profit > best.profit) {
                    best = {
                        source,
                        path,
                        buy,
                        income,
                        cost,
                        profit,
                        profitPercentage: (profit / cost) * 100,
                    };
                }
            }

            return { item, best, ways };
        });
}
