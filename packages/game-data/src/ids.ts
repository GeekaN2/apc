import type { Item } from "./model.ts";

/**
 * Ids used by the market (and Albion Online Data): enchantments get an `@N` suffix,
 * journals are traded as `_EMPTY` and `_FULL`
 */
export function marketIds(item: Item): string[] {
    if (item.kind === "journalitem") {
        return [`${item.uniqueName}_EMPTY`, `${item.uniqueName}_FULL`];
    }

    if (item.enchantmentLevel) {
        return [`${item.uniqueName}@${item.enchantmentLevel}`];
    }

    return [
        item.uniqueName,
        ...item.enchantments.map((e) => `${item.uniqueName}@${e.enchantmentLevel}`),
    ];
}
