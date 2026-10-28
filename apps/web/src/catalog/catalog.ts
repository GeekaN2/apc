import { type Catalog, createCatalog } from "@apc/calc";
import type { CraftingModifiers, GameConstants, Item } from "@apc/game-data";
import { useQuery } from "@tanstack/react-query";

/** Cities with a market, as `/api/prices` accepts them */
export const CITIES = [
    "Thetford",
    "Lymhurst",
    "Bridgewatch",
    "Martlock",
    "Fort Sterling",
    "Caerleon",
    "Brecilien",
    "Black Market",
] as const;

export type City = (typeof CITIES)[number];

/** Cities with crafting stations: the Black Market only buys */
export const CRAFTING_CITIES = CITIES.filter((city) => city !== "Black Market");

export type CraftingCity = Exclude<City, "Black Market">;

/**
 * Catalog of simple items (resources, tokens) with crafting modifiers and economy
 * constants. Loaded on demand: the JSON goes to its own chunk with a hashed name.
 */
async function loadResourceCatalog(): Promise<Catalog> {
    const [items, modifiers, constants] = await Promise.all([
        import("@apc/game-data/generated/items/simpleitem.json"),
        import("@apc/game-data/generated/crafting-modifiers.json"),
        import("@apc/game-data/generated/game-constants.json"),
    ]);

    return createCatalog(
        items.default as Item[],
        modifiers.default as CraftingModifiers,
        constants.default as GameConstants,
    );
}

export function useResourceCatalog() {
    return useQuery({
        queryKey: ["catalog", "resources"],
        queryFn: loadResourceCatalog,
        staleTime: Infinity,
    });
}

/** Cluster of a city in `craftingmodifiers.json`, for the city bonus */
export function clusterIdOf(catalog: Catalog, city: CraftingCity): string | undefined {
    return catalog.modifiers.craftingLocation.find((l) => l.clusterName === city)
        ?.clusterId;
}

/** Item icon from the official render service */
export function itemIconUrl(marketId: string, size = 64): string {
    return `https://render.albiononline.com/v1/item/${encodeURIComponent(marketId)}.png?size=${size}`;
}
