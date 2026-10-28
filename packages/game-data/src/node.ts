/** Reads the generated catalog from disk, for Node services and tests */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { CraftingModifiers, GameConstants, Item } from "./model.ts";

const GENERATED = path.join(import.meta.dirname, "../generated");

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(path.join(GENERATED, file), "utf8")) as T;
}

export function readItems(): Item[] {
    return readdirSync(path.join(GENERATED, "items")).flatMap((file) =>
        readJson<Item[]>(`items/${file}`),
    );
}

export function readCraftingModifiers(): CraftingModifiers {
    return readJson<CraftingModifiers>("crafting-modifiers.json");
}

export function readGameConstants(): GameConstants {
    return readJson<GameConstants>("game-constants.json");
}
