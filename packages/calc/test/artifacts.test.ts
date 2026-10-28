import { describe, expect, it } from "vitest";
import {
    artifactJournals,
    artifactsOfFragment,
    fragmentRecipe,
    profitStats,
} from "../src/artifacts.ts";
import { itemMarketId } from "../src/catalog.ts";
import { craft } from "../src/craft.ts";
import { fakePrice, getItem, loadCatalog } from "./catalog.ts";
import {
    type LegacyBranch,
    type LegacyFragment,
    legacyArtifactBranches,
    legacyCell,
} from "./legacy/artifactFoundry.ts";

const catalog = loadCatalog();
const legacyBranches = legacyArtifactBranches();
const FRAGMENTS: LegacyFragment[] = ["RUNE", "SOUL", "RELIC", "SHARD_AVALONIAN"];
const JOURNALS: Record<LegacyBranch, string> = {
    WARRIOR_BRANCH: "T4_JOURNAL_WARRIOR",
    HUNTER_BRANCH: "T4_JOURNAL_HUNTER",
    MAGE_BRANCH: "T4_JOURNAL_MAGE",
};
const price = (marketId: string) => fakePrice(marketId);

/** T4 artifact names of a branch without the tier, like the old lists */
function branchArtifacts(fragment: LegacyFragment, branch: LegacyBranch): string[] {
    return artifactsOfFragment(catalog, `T4_${fragment}`)
        .filter((artifact) =>
            artifactJournals(catalog, artifact).some(
                (j) => j.uniqueName === JOURNALS[branch],
            ),
        )
        .map((artifact) => artifact.uniqueName.slice(3))
        .sort();
}

/** Artifacts added to the game after the old calculator */
const NEW_ARTIFACTS: Record<LegacyFragment, Partial<Record<LegacyBranch, string[]>>> = {
    RUNE: { HUNTER_BRANCH: ["ARTEFACT_2H_SHAPESHIFTER_MORGANA"] },
    SOUL: { HUNTER_BRANCH: ["ARTEFACT_2H_SHAPESHIFTER_HELL"] },
    RELIC: {
        WARRIOR_BRANCH: [
            "ARTEFACT_ARMOR_PLATE_FEY",
            "ARTEFACT_HEAD_PLATE_FEY",
            "ARTEFACT_SHOES_PLATE_FEY",
        ],
        HUNTER_BRANCH: [
            "ARTEFACT_2H_SHAPESHIFTER_KEEPER",
            "ARTEFACT_ARMOR_LEATHER_FEY",
            "ARTEFACT_HEAD_LEATHER_FEY",
            "ARTEFACT_SHOES_LEATHER_FEY",
        ],
        MAGE_BRANCH: [
            "ARTEFACT_ARMOR_CLOTH_FEY",
            "ARTEFACT_HEAD_CLOTH_FEY",
            "ARTEFACT_SHOES_CLOTH_FEY",
        ],
    },
    SHARD_AVALONIAN: { HUNTER_BRANCH: ["ARTEFACT_2H_SHAPESHIFTER_AVALON"] },
};

describe("artifact branches", () => {
    it.each(FRAGMENTS)(
        "%s: the old lists plus artifacts added since then",
        (fragment) => {
            for (const branch of Object.keys(JOURNALS) as LegacyBranch[]) {
                const expected = [
                    ...legacyBranches[branch][fragment],
                    ...(NEW_ARTIFACTS[fragment][branch] ?? []),
                ].sort();

                expect(
                    branchArtifacts(fragment, branch),
                    `${fragment} ${branch}`,
                ).toEqual(expected);
            }
        },
    );

    it("leaves cape crests and items outside of journals without a branch", () => {
        const withoutBranch = FRAGMENTS.flatMap((fragment) =>
            artifactsOfFragment(catalog, `T4_${fragment}`),
        )
            .filter((artifact) => artifactJournals(catalog, artifact).length === 0)
            .map((artifact) => artifact.uniqueName);

        expect(withoutBranch).toEqual([
            "T4_CAPEITEM_HERETIC_BP",
            "T4_CAPEITEM_UNDEAD_BP",
            "T4_CAPEITEM_KEEPER_BP",
            "T4_CAPEITEM_MORGANA_BP",
            "T4_CAPEITEM_DEMON_BP",
            "T4_ARTEFACT_2H_IRONGAUNTLETS_HELL",
        ]);
    });

    it("knows the new fragment types", () => {
        expect(artifactsOfFragment(catalog, "T4_SHARD_CRYSTAL").length).toBeGreaterThan(
            0,
        );
        expect(
            artifactsOfFragment(catalog, "T4_SHARD_FIRE_DRAGON").length,
        ).toBeGreaterThan(0);
    });
});

describe("artifact profit", () => {
    it.each(FRAGMENTS)("%s: branch mean and spread match the old cells", (fragment) => {
        for (const branch of Object.keys(JOURNALS) as LegacyBranch[]) {
            for (let tier = 4; tier <= 8; tier++) {
                const names = legacyBranches[branch][fragment];
                const legacy = legacyCell(names, fragment, tier, 50, price);
                const profits = names.map((name) => {
                    const artifact = getItem(catalog, `T${tier}_${name}`);
                    const recipe = fragmentRecipe(catalog, artifact)!;
                    const result = craft({
                        catalog,
                        item: artifact,
                        recipe,
                        resourcePrice: price,
                        sale: { price: price(itemMarketId(artifact)), kind: "sellOrder" },
                        returnRate: 0,
                        feePer100Nutrition: 0,
                    });

                    expect(recipe.craftResource).toEqual([
                        {
                            uniqueName: `T${tier}_${fragment}`,
                            count: 50,
                            enchantmentLevel: 0,
                        },
                    ]);

                    return result.profit!;
                });
                const stats = profitStats(profits)!;
                const label = `${fragment} ${branch} T${tier}`;

                expect(stats.mean, label).toBeCloseTo(legacy.averageMeanProfit, 6);
                expect(stats.standardDeviation ** 2, label).toBeCloseTo(
                    legacy.variance,
                    2,
                );
            }
        }
    });
});

describe("profitStats", () => {
    it("takes the middle of an odd list and the average of an even one", () => {
        expect(profitStats([3, 1, 2])).toEqual({
            count: 3,
            mean: 2,
            median: 2,
            standardDeviation: Math.sqrt(2 / 3),
        });
        expect(profitStats([1, 2, 3, 10])?.median).toBe(2.5);
        expect(profitStats([])).toBeUndefined();
    });
});

it("crafts an artifact with the station fee of its item value", () => {
    const artifact = getItem(catalog, "T4_ARTEFACT_MAIN_SCIMITAR_MORGANA");
    const result = craft({
        catalog,
        item: artifact,
        recipe: fragmentRecipe(catalog, artifact)!,
        resourcePrice: () => 100,
        sale: { price: 10_000, kind: "sellOrder" },
        returnRate: 0,
        feePer100Nutrition: 1_000,
    });

    expect(result.itemValue).toBe(96);
    expect(result.stationFee).toBeCloseTo(96 * 0.1125 * 10, 10);
});
