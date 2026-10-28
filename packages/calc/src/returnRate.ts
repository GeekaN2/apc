import type { CraftingModifiers, Item } from "@apc/game-data";

/** Production bonus of crafting with focus */
export const FOCUS_BONUS = 0.59;

export interface ProductionBonusOptions {
    modifiers: CraftingModifiers;
    /** Crafted item: its `craftingCategory` picks the location specialization */
    item: Item;
    /** City cluster from `craftingmodifiers.json`; no location means no bonus */
    clusterId?: string;
    useFocus: boolean;
}

/** Refined resources get `refiningbonus` instead of `craftingbonus` */
export function isRefining(item: Item, modifiers: CraftingModifiers): boolean {
    return (
        item.craftingCategory !== undefined &&
        modifiers.refiningCategory.includes(item.craftingCategory)
    );
}

/** Location bonus + category specialization + focus */
export function productionBonus({
    modifiers,
    item,
    clusterId,
    useFocus,
}: ProductionBonusOptions): number {
    const location = modifiers.craftingLocation.find((l) => l.clusterId === clusterId);
    const base = isRefining(item, modifiers)
        ? location?.refiningBonus?.value
        : location?.craftingBonus?.value;
    const specialization = location?.craftingModifier.find(
        (m) => m.name === item.craftingCategory,
    )?.value;

    return (base ?? 0) + (specialization ?? 0) + (useFocus ? FOCUS_BONUS : 0);
}

/** Share of returnable resources given back by a craft */
export function returnRate(bonus: number): number {
    return 1 - 1 / (1 + bonus);
}
