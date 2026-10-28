import type { Item } from "@apc/game-data";
import {
    fragmentRecipe,
    isFragment,
    profitStats,
    type ProfitStats,
} from "./artifacts.ts";
import { type Catalog, itemMarketId, recipesOf } from "./catalog.ts";
import { type CraftResult, craft } from "./craft.ts";
import type { Sale } from "./market.ts";

/** Fragments melded into artifacts at the artifact foundry */
export const FRAGMENT_TYPES = [
    "RUNE",
    "SOUL",
    "RELIC",
    "SHARD_AVALONIAN",
    "SHARD_CRYSTAL",
    "SHARD_FIRE_DRAGON",
] as const;

export type FragmentType = (typeof FRAGMENT_TYPES)[number];

/** Journal branches, `T4_JOURNAL_WARRIOR` → WARRIOR; none for cape crests and the like */
export type Branch = string;

/**
 * Branch of every artifact: the journal filled by the items it goes into.
 * One pass over the catalog instead of `artifactJournals` per artifact.
 */
export function artifactBranches(catalog: Catalog): ReadonlyMap<string, Branch> {
    const branches = new Map<string, Branch>();

    for (const item of catalog.items) {
        const journal = catalog.journalFor(item.uniqueName);
        const branch = journal?.uniqueName.match(/_JOURNAL_([A-Z]+)/)?.[1];

        if (!branch) {
            continue;
        }

        const recipes = [
            ...recipesOf(item),
            ...item.enchantments.flatMap((e) => e.craftingRequirements),
        ];

        for (const resource of recipes.flatMap((recipe) => recipe.craftResource)) {
            const component = catalog.item(resource.uniqueName);

            if (component?.shopCategory === "artefacts" && !isFragment(component)) {
                branches.set(component.uniqueName, branch);
            }
        }
    }

    return branches;
}

export interface FoundryOptions {
    catalog: Catalog;
    fragment: FragmentType;
    /** Price per unit of fragments and anything else a recipe takes, by market id */
    resourcePrice: (marketId: string) => number | undefined;
    /** How an artifact is sold, by market id */
    sale: (marketId: string) => Sale;
    /** Share of fragments given back; the old calculator assumed none */
    returnRate: number;
    feePer100Nutrition: number;
    premium: boolean;
}

export interface FoundryArtifact {
    artifact: Item;
    marketId: string;
    tier: number;
    branch?: Branch;
    result: CraftResult;
}

/** Profit of melding fragments of a type into every artifact made of them */
export function foundry(
    options: FoundryOptions,
    branches: ReadonlyMap<string, Branch>,
): FoundryArtifact[] {
    const { catalog, fragment } = options;

    return catalog.items.flatMap((artifact) => {
        const recipe = fragmentRecipe(catalog, artifact);

        // Souls also make hellgate and corrupted dungeon maps, which are not artifacts
        if (
            artifact.shopCategory !== "artefacts" ||
            !recipe ||
            !recipe.craftResource.some(
                (r) => r.uniqueName === `T${artifact.tier}_${fragment}`,
            )
        ) {
            return [];
        }

        return {
            artifact,
            marketId: itemMarketId(artifact),
            tier: artifact.tier,
            branch: branches.get(artifact.uniqueName),
            result: craft({
                catalog,
                item: artifact,
                recipe,
                resourcePrice: options.resourcePrice,
                sale: options.sale(itemMarketId(artifact)),
                returnRate: options.returnRate,
                feePer100Nutrition: options.feePer100Nutrition,
                premium: options.premium,
            }),
        };
    });
}

export interface FoundryGroup {
    /** Artifacts with a profit, the most profitable first */
    artifacts: FoundryArtifact[];
    /** Artifacts without a price, left out of the statistics */
    unpriced: FoundryArtifact[];
    stats?: ProfitStats;
    /** Mean profit over the mean cost, in percent */
    meanPercentage?: number;
}

/** Statistics of a branch or of all artifacts of a tier */
export function foundryGroup(artifacts: readonly FoundryArtifact[]): FoundryGroup {
    const priced = artifacts
        .filter((a) => a.result.profit !== undefined)
        .sort((a, b) => b.result.profit! - a.result.profit!);
    const stats = profitStats(priced.map((a) => a.result.profit!));
    const meanCost =
        priced.reduce((sum, a) => sum + a.result.cost!, 0) / (priced.length || 1);

    return {
        artifacts: priced,
        unpriced: artifacts.filter((a) => a.result.profit === undefined),
        stats,
        meanPercentage: stats && meanCost > 0 ? (stats.mean / meanCost) * 100 : undefined,
    };
}
