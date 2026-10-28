import { z } from "zod";
import { marketIds } from "./ids.ts";
import {
    IGNORED_ITEM_SECTIONS,
    ITEM_KINDS,
    type Item,
    type ItemKind,
    type Names,
    type ShopCategory,
} from "./model.ts";
import {
    formattedItemsFile,
    itemSchema,
    itemsFile,
    localizationEntry,
    localizationFile,
    shopCategories,
} from "./raw.ts";

const CATEGORY_KEY = "@MARKETPLACEGUI_ROLLOUT_SHOPCATEGORY_";
const SUBCATEGORY_KEY = "@MARKETPLACEGUI_ROLLOUT_SHOPSUBCATEGORY_";

function isItemKind(section: string): section is ItemKind {
    return (ITEM_KINDS as readonly string[]).includes(section);
}

function isIgnoredSection(section: string) {
    return (IGNORED_ITEM_SECTIONS as readonly string[]).includes(section);
}

/** Parses all item sections of `items.json`, keeping the dump order */
export function buildItems(json: unknown): Item[] {
    const { items } = itemsFile.parse(json);
    const result: Item[] = [];

    for (const [section, list] of Object.entries(items)) {
        if (!Array.isArray(list) || isIgnoredSection(section)) {
            continue;
        }

        if (!isItemKind(section)) {
            throw new Error(
                `Unknown items.json section "${section}", add it to ITEM_KINDS`,
            );
        }

        const schema = itemSchema(section);

        for (const raw of list) {
            const parsed = schema.safeParse(raw);

            if (!parsed.success) {
                const name = (raw as Record<string, unknown>)["@uniquename"];

                throw new Error(
                    `${section} ${String(name)}:\n${z.prettifyError(parsed.error)}`,
                );
            }

            result.push(parsed.data);
        }
    }

    return result;
}

/** Marketplace category tree from `items.json` */
export function buildCategories(json: unknown): ShopCategory[] {
    return shopCategories.parse(itemsFile.parse(json).items.shopcategories);
}

/** Market ids of the catalog that `formatted/items.json` doesn't know about */
export function findUnknownMarketIds(items: Item[], formattedJson: unknown): string[] {
    const known = new Set(
        formattedItemsFile.parse(formattedJson).map((i) => i.UniqueName),
    );

    return items.flatMap(marketIds).filter((id) => !known.has(id));
}

/** `EN-US` → `en-US` */
function toLocale(lang: string) {
    const [language = "", region = ""] = lang.split("-");

    return region
        ? `${language.toLowerCase()}-${region.toUpperCase()}`
        : language.toLowerCase();
}

function names(byLocale: Map<string, Names>, lang: string): Names {
    const locale = toLocale(lang);
    let result = byLocale.get(locale);

    if (!result) {
        result = { items: {}, categories: {} };
        byLocale.set(locale, result);
    }

    return result;
}

function categoryKeys(categories: ShopCategory[], depth = 0): Map<string, string> {
    const keys = new Map<string, string>();

    for (const c of categories) {
        const prefix = depth === 0 ? CATEGORY_KEY : SUBCATEGORY_KEY;

        keys.set(`${prefix}${c.id.toUpperCase()}`, c.id);

        for (const [key, id] of categoryKeys(c.children, depth + 1)) {
            keys.set(key, id);
        }
    }

    return keys;
}

/** Item names from `formatted/items.json` and category names from `localization.json` */
export function buildNames(
    formattedJson: unknown,
    localizationJson: unknown,
    categories: ShopCategory[],
): Map<string, Names> {
    const byLocale = new Map<string, Names>();

    for (const item of formattedItemsFile.parse(formattedJson)) {
        const at = item.UniqueName.indexOf("@");
        const base = at === -1 ? undefined : item.UniqueName.slice(0, at);

        for (const [lang, name] of Object.entries(item.LocalizedNames ?? {})) {
            const localeNames = names(byLocale, lang);

            // Enchanted equipment has the same name as the base item
            if (!name || (base && localeNames.items[base] === name)) {
                continue;
            }

            localeNames.items[item.UniqueName] = name;
        }
    }

    const keys = categoryKeys(categories);
    const entries = localizationFile
        .parse(localizationJson)
        .tmx.body.tu.filter((tu) => keys.has(tu["@tuid"]));

    for (const raw of entries) {
        const entry = localizationEntry.parse(raw);
        const id = keys.get(entry["@tuid"]);

        for (const tuv of entry.tuv) {
            if (id && tuv.seg) {
                names(byLocale, tuv["@xml:lang"]).categories[id] = tuv.seg;
            }
        }
    }

    return byLocale;
}
