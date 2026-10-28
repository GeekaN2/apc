import { describe, expect, it } from "vitest";
import {
    DEFAULT_TREE_SETTINGS,
    TREE_SETTINGS_VERSION,
    treeSettingsFromServer,
    treeSettingsToServer,
} from "../src/store/treeSettings";

/** As the old calculator saved them, see `store/profit-tree/typeDefs.ts` */
const legacy = {
    useJournals: true,
    useFocus: false,
    useMultipleCities: true,
    showAverageItems: false,
    useAveragePrice: false,
    useExpertMode: true,
    returnPercentage: "24.8",
    craftFee: "",
    itemsMultiplier: 10,
    cities: {
        sellItems: "Black Market",
        craftItems: "Lymhurst",
        resourcesFirstLocation: "Martlock",
        resourcesSecondLocation: "Thetford",
        artefacts: "Caerleon",
        journals: "Bridgewatch",
    },
    expert: {
        useOwnPercentage: true,
        useMinPricesNormalization: false,
        qualities: [2, 1, 7],
    },
};

describe("treeSettingsFromServer", () => {
    it("has nothing when nothing was saved", () => {
        expect(treeSettingsFromServer({})).toBeUndefined();
        expect(treeSettingsFromServer(null)).toBeUndefined();
    });

    it("maps the old calculator's settings", () => {
        expect(treeSettingsFromServer(legacy)).toEqual({
            ...DEFAULT_TREE_SETTINGS,
            sameCity: false,
            cities: {
                sell: "Black Market",
                craft: "Lymhurst",
                resources: "Martlock",
                components: "Caerleon",
                journals: "Bridgewatch",
            },
            useJournals: true,
            crafts: 10,
            ownReturnRate: 24.8,
            qualities: [1, 2],
        });
    });

    it("puts everything into the selling city without multiple cities", () => {
        const settings = treeSettingsFromServer({
            useMultipleCities: false,
            cities: { sellItems: "Black Market" },
            craftFee: 800,
        });

        expect(settings?.sameCity).toBe(true);
        expect(settings?.fee).toBe(800);
        expect(settings?.cities).toEqual({
            sell: "Black Market",
            craft: "Caerleon",
            resources: "Caerleon",
            components: "Caerleon",
            journals: "Caerleon",
        });
    });

    it("ignores the own return rate when it was switched off", () => {
        expect(
            treeSettingsFromServer({
                returnPercentage: 30,
                expert: { useOwnPercentage: false },
            })?.ownReturnRate,
        ).toBeUndefined();
    });

    it("reads back what it saves", () => {
        const settings = { ...DEFAULT_TREE_SETTINGS, fee: 750, ownReturnRate: 40 };
        const saved = JSON.parse(JSON.stringify(treeSettingsToServer(settings)));

        expect(saved.version).toBe(TREE_SETTINGS_VERSION);
        expect(treeSettingsFromServer(saved)).toEqual(settings);
    });
});
