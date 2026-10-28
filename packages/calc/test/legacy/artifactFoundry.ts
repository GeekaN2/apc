/**
 * Artifact foundry of the old calculator, transcribed from albion-profit-calculator:
 * store/artifact-foundry/actions.ts (FETCH_STATE: artifact branches from
 * profitTreeItemsTree.json) and store/artifact-foundry/getters.ts (getCellItems).
 * The old game melded fragments into a random artifact of a branch.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const MARKET_SELL_ORDER_FEE = 6.5;

export type LegacyFragment = "RUNE" | "SOUL" | "RELIC" | "SHARD_AVALONIAN";
export type LegacyBranch = "WARRIOR_BRANCH" | "HUNTER_BRANCH" | "MAGE_BRANCH";

interface TreeItem {
    name: string;
    children?: TreeItem[];
}

/** actions.ts: FETCH_STATE, the last four non-fey items of a group are rune → avalon */
export function legacyArtifactBranches(): Record<
    LegacyBranch,
    Record<LegacyFragment, string[]>
> {
    const tree = JSON.parse(
        readFileSync(path.join(import.meta.dirname, "profitTreeItemsTree.json"), "utf8"),
    ) as TreeItem[];
    const [warriorBranch, hunterBranch, mageBranch] = tree;

    const areAllChildrenLeafs = (items: TreeItem[]) =>
        items.every((item) => !item.children);

    const getArtifactBranch = (branchTree: TreeItem) => {
        const artifactItems: Record<LegacyFragment, string[]> = {
            RUNE: [],
            SOUL: [],
            RELIC: [],
            SHARD_AVALONIAN: [],
        };

        const getAllArtifactLeafs = (treeItem: TreeItem) => {
            if (treeItem.children && !areAllChildrenLeafs(treeItem.children)) {
                treeItem.children.forEach((item) => getAllArtifactLeafs(item));
            } else if (
                treeItem.children &&
                treeItem.children.length >= 4 &&
                areAllChildrenLeafs(treeItem.children)
            ) {
                const names = treeItem.children
                    .map((item) => item.name)
                    .filter((item) => !item.includes("_FEY"));
                const [rune, soul, relic, avaShard] = names
                    .slice(-4)
                    .map((name) => "ARTEFACT_" + name.slice(3));

                artifactItems.RUNE.push(rune!);
                artifactItems.SOUL.push(soul!);
                artifactItems.RELIC.push(relic!);
                artifactItems.SHARD_AVALONIAN.push(avaShard!);
            }
        };

        getAllArtifactLeafs(branchTree);

        return artifactItems;
    };

    return {
        WARRIOR_BRANCH: getArtifactBranch(warriorBranch!),
        HUNTER_BRANCH: getArtifactBranch(hunterBranch!),
        MAGE_BRANCH: getArtifactBranch(mageBranch!),
    };
}

export interface LegacyCell {
    averageMeanProfit: number;
    variance: number;
    medianItemPrice: number;
    fragmentExpenses: number;
}

/** getters.ts: getCellItems for one branch and tier */
export function legacyCell(
    branchItems: string[],
    fragment: LegacyFragment,
    tier: number,
    fragmentsPerMeld: number,
    price: (marketId: string) => number,
): LegacyCell {
    const items = branchItems.map((name) => ({
        itemId: `T${tier}_${name}`,
        sellPriceMin: price(`T${tier}_${name}`),
    }));
    const fragmentExpenses = price(`T${tier}_${fragment}`) * fragmentsPerMeld;
    const getItemProfit = (item: { sellPriceMin: number }) =>
        (item.sellPriceMin * (100 - MARKET_SELL_ORDER_FEE)) / 100 - fragmentExpenses;
    const totalProfit = items.reduce((acc, item) => acc + getItemProfit(item), 0);
    const averageMeanProfit = totalProfit / items.length;
    const variance =
        items.reduce(
            (acc, item) => acc + (getItemProfit(item) - averageMeanProfit) ** 2,
            0,
        ) / items.length;
    const sortedItems = [...items].sort((a, b) => a.sellPriceMin - b.sellPriceMin);

    return {
        averageMeanProfit,
        variance,
        medianItemPrice: sortedItems[Math.floor(items.length / 2)]!.sellPriceMin,
        fragmentExpenses,
    };
}
