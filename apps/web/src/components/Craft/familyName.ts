import type { ItemFamily } from "@apc/calc";

/** Item name without the tier: "Broadsword" out of "Expert's Broadsword" or "Палаш (знаток)" */
export function familyName(
    family: ItemFamily,
    names: Readonly<Record<string, string>> | undefined,
): string {
    const item = family.items.find((i) => i.tier === 4) ?? family.items[0]!;
    const name = names?.[item.uniqueName];

    if (!name) {
        return family.key;
    }

    return name
        .replace(/\s*\([^)]*\)$/, "")
        .replace(
            /^(Novice's|Journeyman's|Adept's|Expert's|Master's|Grandmaster's|Elder's|Beginner's)\s+/,
            "",
        );
}

/** Icon of a family: its T4 item or the lowest tier */
export function familyIcon(family: ItemFamily): string {
    return (family.items.find((item) => item.tier === 4) ?? family.items[0]!).uniqueName;
}
