import type { CraftingRequirement, Item } from "@apc/game-data";
import type { Catalog } from "./catalog.ts";

/** Runes, souls, relics and shards: the `artefacts/fragments` marketplace category */
export function isFragment(item: Item): boolean {
    return item.shopCategory === "artefacts" && item.shopSubcategory1 === "fragments";
}

/** Recipe of an artifact made of fragments at the artifact foundry */
export function fragmentRecipe(
    catalog: Catalog,
    artifact: Item,
): CraftingRequirement | undefined {
    if (isFragment(artifact)) {
        return undefined;
    }

    return artifact.craftingRequirements.find((recipe) =>
        recipe.craftResource.some((r) => {
            const resource = catalog.item(r.uniqueName);

            return resource !== undefined && isFragment(resource);
        }),
    );
}

/** Artifacts crafted from a fragment, e.g. every rune artifact of a tier */
export function artifactsOfFragment(catalog: Catalog, fragment: string): Item[] {
    return catalog.items.filter((item) =>
        fragmentRecipe(catalog, item)?.craftResource.some(
            (r) => r.uniqueName === fragment,
        ),
    );
}

/** Items crafted with a resource, e.g. weapons that need an artifact */
export function itemsCraftedWith(catalog: Catalog, uniqueName: string): Item[] {
    return catalog.items.filter((item) =>
        [
            item.craftingRequirements,
            ...item.enchantments.map((e) => e.craftingRequirements),
        ]
            .flat()
            .some((recipe) =>
                recipe.craftResource.some((r) => r.uniqueName === uniqueName),
            ),
    );
}

/**
 * Journals filled by the items an artifact goes into. They split artifacts
 * into the warrior, hunter, mage and toolmaker branches.
 */
export function artifactJournals(catalog: Catalog, artifact: Item): Item[] {
    const journals = itemsCraftedWith(catalog, artifact.uniqueName)
        .map((item) => catalog.journalFor(item.uniqueName))
        .filter((journal) => journal !== undefined);

    return [...new Set(journals)];
}

export interface ProfitStats {
    count: number;
    mean: number;
    median: number;
    /** Population standard deviation */
    standardDeviation: number;
}

/** Statistics over profits, e.g. of all artifacts of a branch */
export function profitStats(profits: number[]): ProfitStats | undefined {
    if (profits.length === 0) {
        return undefined;
    }

    const count = profits.length;
    const mean = profits.reduce((sum, p) => sum + p, 0) / count;
    const variance = profits.reduce((sum, p) => sum + (p - mean) ** 2, 0) / count;
    const sorted = [...profits].sort((a, b) => a - b);
    const middle = Math.floor(count / 2);
    const median =
        count % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;

    return { count, mean, median, standardDeviation: Math.sqrt(variance) };
}
