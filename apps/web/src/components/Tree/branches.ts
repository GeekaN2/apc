import type { Catalog, ItemFamily } from "@apc/calc";

/** Crafting stations of the game's skill tree, like the old tree's roots */
export const BRANCHES = ["WARRIOR", "HUNTER", "MAGE", "TOOLMAKER"] as const;

export type Branch = (typeof BRANCHES)[number];

/** Where a family sits in the tree: its station and its group of items */
export interface TreePlace {
    branch: Branch;
    /** Marketplace subcategory; every cape is one group */
    group: string;
}

/** `T4_JOURNAL_WARRIOR` → WARRIOR */
function journalBranch(catalog: Catalog, family: ItemFamily): Branch | undefined {
    for (const item of family.items) {
        const branch = catalog
            .journalFor(item.uniqueName)
            ?.uniqueName.match(/_JOURNAL_([A-Z]+)/)?.[1];

        if (branch && (BRANCHES as readonly string[]).includes(branch)) {
            return branch as Branch;
        }
    }

    return undefined;
}

/**
 * Places families in the tree by the journal they fill. Families without one,
 * like royal sets, go where most of their subcategory went, the rest to the
 * toolmaker.
 */
export function placeFamilies(
    catalog: Catalog,
    families: readonly ItemFamily[],
): Map<string, TreePlace> {
    const own = new Map(families.map((f) => [f.key, journalBranch(catalog, f)]));
    const votes = new Map<string, Map<Branch, number>>();

    for (const family of families) {
        const branch = own.get(family.key);

        if (branch) {
            const counts =
                votes.get(family.shopSubcategory1) ?? new Map<Branch, number>();

            counts.set(branch, (counts.get(branch) ?? 0) + 1);
            votes.set(family.shopSubcategory1, counts);
        }
    }

    return new Map(
        families.map((family) => {
            const majority = [...(votes.get(family.shopSubcategory1) ?? [])].sort(
                (a, b) => b[1] - a[1],
            )[0]?.[0];

            return [
                family.key,
                {
                    branch: own.get(family.key) ?? majority ?? "TOOLMAKER",
                    group:
                        family.shopCategory === "capes"
                            ? "capes"
                            : family.shopSubcategory1,
                },
            ];
        }),
    );
}
