import { describe, expect, it } from "vitest";
import { artifactJournals } from "../src/artifacts.ts";
import { artifactBranches, foundry, foundryGroup } from "../src/foundry.ts";
import { fakePrice, getItem, loadCatalog } from "./catalog.ts";

const catalog = loadCatalog();
const branches = artifactBranches(catalog);

describe("artifactBranches", () => {
    it("matches the journals of the items an artifact goes into", () => {
        for (const name of [
            "T4_ARTEFACT_2H_CLAYMORE_AVALON",
            "T5_ARTEFACT_2H_BOW_KEEPER",
            "T6_ARTEFACT_MAIN_FROSTSTAFF_KEEPER",
        ]) {
            const journal = artifactJournals(catalog, getItem(catalog, name))[0]!;

            expect(journal.uniqueName).toContain(`_JOURNAL_${branches.get(name)}`);
        }
    });

    it("leaves cape crests without a branch", () => {
        expect(branches.get("T4_CAPEITEM_HERETIC_BP")).toBeUndefined();
    });
});

describe("foundry", () => {
    const artifacts = foundry(
        {
            catalog,
            fragment: "RUNE",
            resourcePrice: (id) => fakePrice(id),
            sale: (id) => ({ price: fakePrice(id), kind: "sellOrder" }),
            returnRate: 0,
            feePer100Nutrition: 0,
            premium: false,
        },
        branches,
    );

    it("leaves out maps made of souls", () => {
        const souls = foundry(
            {
                catalog,
                fragment: "SOUL",
                resourcePrice: () => 1,
                sale: () => ({ price: 1, kind: "sellOrder" }),
                returnRate: 0,
                feePer100Nutrition: 0,
                premium: true,
            },
            branches,
        );

        expect(souls.some((a) => a.marketId.includes("_MAP"))).toBe(false);
    });

    it("melds 50 fragments of the artifact's tier", () => {
        expect(artifacts.length).toBeGreaterThan(5 * 25);
        expect(
            artifacts.every((a) =>
                a.result.resources.every(
                    (r) => r.marketId === `T${a.tier}_RUNE` && r.count === 50,
                ),
            ),
        ).toBe(true);
    });

    it("sorts a group by profit and leaves unpriced artifacts out", () => {
        const t4 = artifacts.filter((a) => a.tier === 4 && a.branch === "WARRIOR");
        const unpriced = { ...t4[0]!, result: { ...t4[0]!.result, profit: undefined } };
        const group = foundryGroup([...t4.slice(1), unpriced]);

        expect(group.unpriced).toEqual([unpriced]);
        expect(group.stats?.count).toBe(t4.length - 1);
        expect(group.artifacts[0]!.result.profit).toBeGreaterThanOrEqual(
            group.artifacts.at(-1)!.result.profit!,
        );
        expect(group.meanPercentage).toBeDefined();
    });
});
