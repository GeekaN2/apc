import { CITIES, CRAFTING_CITIES, type City, type CraftingCity } from "../catalog/cities";

export interface TreeCities {
    sell: City;
    /** Where items are crafted: the city bonus */
    craft: CraftingCity;
    /** Refined resources */
    resources: CraftingCity;
    /** Artifacts, hearts, sigils, base items of upgraded ones */
    components: CraftingCity;
    journals: CraftingCity;
}

/** Profit tree settings, also stored on the server for signed in users */
export interface TreeSettings {
    /** One city for buying, crafting and selling */
    sameCity: boolean;
    cities: TreeCities;
    useFocus: boolean;
    premium: boolean;
    /** Station fee per 100 nutrition */
    fee: number;
    crafts: number;
    /** Return rate in percent instead of the one from the city and focus */
    ownReturnRate?: number;
    useJournals: boolean;
    /** Qualities whose prices are merged into the sale price */
    qualities: number[];
}

/** Format version of the settings on the server; the old calculator had none */
export const TREE_SETTINGS_VERSION = 2;

export const DEFAULT_TREE_SETTINGS: TreeSettings = {
    sameCity: true,
    cities: {
        sell: "Caerleon",
        craft: "Caerleon",
        resources: "Caerleon",
        components: "Caerleon",
        journals: "Caerleon",
    },
    useFocus: false,
    premium: true,
    fee: 500,
    crafts: 1,
    ownReturnRate: undefined,
    useJournals: false,
    qualities: [1, 2, 3],
};

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Numbers of the old site were sometimes saved as strings */
function number(value: unknown, min: number, max: number): number | undefined {
    const parsed = typeof value === "string" ? Number(value.trim() || NaN) : value;

    return typeof parsed === "number" &&
        Number.isFinite(parsed) &&
        parsed >= min &&
        parsed <= max
        ? parsed
        : undefined;
}

function boolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

function city(value: unknown): City | undefined {
    return CITIES.find((c) => c === value);
}

function craftingCity(value: unknown): CraftingCity | undefined {
    return CRAFTING_CITIES.find((c) => c === value);
}

function qualities(value: unknown): number[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }

    const valid = [...new Set(value.map((q) => number(q, 1, 5)))]
        .filter((q) => q !== undefined && Number.isInteger(q))
        .sort();

    return valid.length > 0 ? (valid as number[]) : undefined;
}

/** Drops undefined values so they don't override defaults */
function defined<T extends object>(value: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(value).filter(([, v]) => v !== undefined),
    ) as Partial<T>;
}

function citiesOf(value: Partial<TreeCities>, base: TreeCities): TreeCities {
    return { ...base, ...defined(value) };
}

/**
 * Settings of the old calculator (`store/profit-tree/typeDefs.ts`), imported from
 * MongoDB as they were saved: fields may be missing and numbers may be strings
 */
function fromLegacy(legacy: Json): TreeSettings {
    const base = DEFAULT_TREE_SETTINGS;
    const cities = isObject(legacy.cities) ? legacy.cities : {};
    const expert = isObject(legacy.expert) ? legacy.expert : {};
    const sell = city(cities.sellItems);
    const useMultipleCities = boolean(legacy.useMultipleCities) ?? false;
    const ownReturnRate =
        boolean(expert.useOwnPercentage) === true
            ? number(legacy.returnPercentage, 0, 99)
            : undefined;

    // Without multiple cities the old site did everything in the selling city,
    // with the Black Market standing for Caerleon
    const single = sell === "Black Market" ? "Caerleon" : craftingCity(sell);
    const singleCities = single
        ? {
              sell: sell ?? single,
              craft: single,
              resources: single,
              components: single,
              journals: single,
          }
        : base.cities;

    return {
        ...base,
        ...defined({
            useFocus: boolean(legacy.useFocus),
            fee: number(legacy.craftFee, 0, 100_000),
            crafts: number(legacy.itemsMultiplier, 1, 10_000),
            useJournals: boolean(legacy.useJournals),
            qualities: qualities(expert.qualities),
        }),
        ownReturnRate,
        sameCity: !useMultipleCities,
        cities: useMultipleCities
            ? citiesOf(
                  {
                      sell,
                      craft: craftingCity(cities.craftItems),
                      resources: craftingCity(cities.resourcesFirstLocation),
                      components: craftingCity(cities.artefacts),
                      journals: craftingCity(cities.journals),
                  },
                  base.cities,
              )
            : singleCities,
    };
}

function fromCurrent(value: Json): TreeSettings {
    const base = DEFAULT_TREE_SETTINGS;
    const cities = isObject(value.cities) ? value.cities : {};

    return {
        ...base,
        ...defined({
            sameCity: boolean(value.sameCity),
            useFocus: boolean(value.useFocus),
            premium: boolean(value.premium),
            fee: number(value.fee, 0, 100_000),
            crafts: number(value.crafts, 1, 10_000),
            useJournals: boolean(value.useJournals),
            qualities: qualities(value.qualities),
        }),
        ownReturnRate: number(value.ownReturnRate, 0, 99),
        cities: citiesOf(
            {
                sell: city(cities.sell),
                craft: craftingCity(cities.craft),
                resources: craftingCity(cities.resources),
                components: craftingCity(cities.components),
                journals: craftingCity(cities.journals),
            },
            base.cities,
        ),
    };
}

/** Settings from `/api/settings/tree`; undefined when nothing was saved */
export function treeSettingsFromServer(value: unknown): TreeSettings | undefined {
    if (!isObject(value) || Object.keys(value).length === 0) {
        return undefined;
    }

    return value.version === TREE_SETTINGS_VERSION
        ? fromCurrent(value)
        : fromLegacy(value);
}

export function treeSettingsToServer(settings: TreeSettings): Json {
    return { version: TREE_SETTINGS_VERSION, ...settings };
}
