/** Builds the catalog in `generated/` from the pinned ao-bin-dumps commit */
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
    buildCategories,
    buildCraftingModifiers,
    buildGameConstants,
    buildItems,
    buildNames,
    findUnknownMarketIds,
} from "../build.ts";
import { PACKAGE_ROOT, readDump, readPin, resolveDumpsDir } from "../dumps.ts";
import type { CatalogMeta, Item, ItemKind } from "../model.ts";

const OUT_DIR = path.join(PACKAGE_ROOT, "generated");

/** One array element per line keeps diffs between game patches readable */
function jsonLines(list: unknown[]) {
    return `[\n${list.map((x) => JSON.stringify(x)).join(",\n")}\n]\n`;
}

function jsonEntries(record: Record<string, unknown>) {
    const lines = Object.entries(record).map(
        ([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`,
    );

    return `{\n${lines.join(",\n")}\n}\n`;
}

const written: string[] = [];

async function write(file: string, content: string) {
    const target = path.join(OUT_DIR, file);

    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
    written.push(file);
}

const pin = await readPin();
const dir = await resolveDumpsDir(pin);

console.log(
    `Building catalog from ${pin.repository}@${pin.commit.slice(0, 8)} (${pin.date})`,
);

const itemsJson = await readDump(dir, "items.json");
const formattedJson = await readDump(dir, "formatted/items.json");
const localizationJson = await readDump(dir, "localization.json");

const items = buildItems(itemsJson);
const categories = buildCategories(itemsJson);
const names = buildNames(formattedJson, localizationJson, categories);
const craftingModifiers = buildCraftingModifiers(
    await readDump(dir, "craftingmodifiers.json"),
    await readDump(dir, "formatted/world.json"),
);
const gameConstants = buildGameConstants(await readDump(dir, "gamedata.json"));

const unknownIds = findUnknownMarketIds(items, formattedJson);

if (unknownIds.length > 0) {
    throw new Error(
        `${unknownIds.length} market ids are missing from formatted/items.json: ` +
            unknownIds.slice(0, 20).join(", "),
    );
}

const byKind = new Map<ItemKind, Item[]>();

for (const item of items) {
    byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);
}

await rm(OUT_DIR, { recursive: true, force: true });

for (const [kind, list] of byKind) {
    await write(`items/${kind}.json`, jsonLines(list));
}

await write("categories.json", `${JSON.stringify(categories, null, 2)}\n`);
await write(
    "crafting-modifiers.json",
    `{\n"refiningCategory": ${JSON.stringify(craftingModifiers.refiningCategory)},\n` +
        `"craftingLocation": ${jsonLines(craftingModifiers.craftingLocation).trimEnd()}\n}\n`,
);
await write("game-constants.json", `${JSON.stringify(gameConstants, null, 2)}\n`);

for (const [locale, localeNames] of names) {
    await write(
        `names/${locale}.json`,
        `{\n"items": ${jsonEntries(localeNames.items).trimEnd()},\n` +
            `"categories": ${jsonEntries(localeNames.categories).trimEnd()}\n}\n`,
    );
}

const meta: CatalogMeta = {
    dumps: pin,
    locales: [...names.keys()].sort(),
    itemCounts: Object.fromEntries(
        [...byKind].map(([kind, list]) => [kind, list.length]),
    ),
};

await write("meta.json", `${JSON.stringify(meta, null, 2)}\n`);

for (const file of written) {
    const { size } = await stat(path.join(OUT_DIR, file));

    console.log(`${file.padEnd(40)} ${(size / 1024).toFixed(0).padStart(6)} KB`);
}

console.log(`${items.length} items, ${names.size} locales`);
