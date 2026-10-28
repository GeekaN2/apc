import { type Catalog, createCatalog } from "@apc/calc";
import type { CraftingModifiers, GameConstants, Item } from "@apc/game-data";
import { useQuery } from "@tanstack/react-query";
import { languages, useLanguageStore } from "../i18n/i18n";
import type { CraftingCity } from "./cities";

export * from "./cities";

const ITEM_FILES = {
    simpleitem: () => import("@apc/game-data/generated/items/simpleitem.json"),
    journalitem: () => import("@apc/game-data/generated/items/journalitem.json"),
    weapon: () => import("@apc/game-data/generated/items/weapon.json"),
    equipmentitem: () => import("@apc/game-data/generated/items/equipmentitem.json"),
    transformationweapon: () =>
        import("@apc/game-data/generated/items/transformationweapon.json"),
    trackingitem: () => import("@apc/game-data/generated/items/trackingitem.json"),
    consumableitem: () => import("@apc/game-data/generated/items/consumableitem.json"),
    consumablefrominventoryitem: () =>
        import("@apc/game-data/generated/items/consumablefrominventoryitem.json"),
    farmableitem: () => import("@apc/game-data/generated/items/farmableitem.json"),
    mount: () => import("@apc/game-data/generated/items/mount.json"),
    furnitureitem: () => import("@apc/game-data/generated/items/furnitureitem.json"),
};

type ItemFile = keyof typeof ITEM_FILES;

/**
 * Catalog of some sections of the dumps with crafting modifiers and economy
 * constants. Loaded on demand: each JSON goes to its own chunk with a hashed name.
 */
async function loadCatalog(files: readonly ItemFile[]): Promise<Catalog> {
    const [modifiers, constants, ...sections] = await Promise.all([
        import("@apc/game-data/generated/crafting-modifiers.json"),
        import("@apc/game-data/generated/game-constants.json"),
        ...files.map((file) => ITEM_FILES[file]()),
    ]);

    return createCatalog(
        sections.flatMap((section) => section.default as Item[]),
        modifiers.default as CraftingModifiers,
        constants.default as GameConstants,
    );
}

function useCatalog(name: string, files: readonly ItemFile[]) {
    return useQuery({
        queryKey: ["catalog", name],
        queryFn: () => loadCatalog(files),
        staleTime: Infinity,
    });
}

/** Simple items: resources, tokens, artifacts */
export function useResourceCatalog() {
    return useCatalog("resources", ["simpleitem"]);
}

/** Craftable equipment with everything its recipes take and journals */
export function useEquipmentCatalog() {
    return useCatalog("equipment", [
        "simpleitem",
        "journalitem",
        "weapon",
        "equipmentitem",
        "transformationweapon",
        "trackingitem",
        "consumableitem",
        "consumablefrominventoryitem",
    ]);
}

/** Everything traded on the market, for its category and weight */
export function useTradeCatalog() {
    return useCatalog("trade", Object.keys(ITEM_FILES) as ItemFile[]);
}

/** Food, potions and their ingredients */
export function useConsumablesCatalog() {
    return useCatalog("consumables", ["simpleitem", "consumableitem", "farmableitem"]);
}

const NAME_FILES = {
    "en-US": () => import("@apc/game-data/generated/names/en-US.json"),
    "ru-RU": () => import("@apc/game-data/generated/names/ru-RU.json"),
};

export interface Names {
    items: Readonly<Record<string, string>>;
    categories: Readonly<Record<string, string>>;
}

/** Localized names of items and marketplace categories in the UI language */
export function useNames() {
    const language = useLanguageStore((state) => state.language);
    const locale = languages[language].gameLocale;

    return useQuery({
        queryKey: ["names", locale],
        queryFn: async (): Promise<Names> => (await NAME_FILES[locale]()).default,
        staleTime: Infinity,
    });
}

/** Cluster of a city in `craftingmodifiers.json`, for the city bonus */
export function clusterIdOf(catalog: Catalog, city: CraftingCity): string | undefined {
    return catalog.modifiers.craftingLocation.find((l) => l.clusterName === city)
        ?.clusterId;
}

/** Item icon from the official render service */
export function itemIconUrl(marketId: string, size = 64, quality = 1): string {
    const url = `https://render.albiononline.com/v1/item/${encodeURIComponent(marketId)}.png?size=${size}`;

    return quality > 1 ? `${url}&quality=${quality}` : url;
}
