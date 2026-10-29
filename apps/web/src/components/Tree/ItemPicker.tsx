import type { ItemFamily } from "@apc/calc";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Names } from "../../catalog/catalog";
import { useTreeStore } from "../../store/tree";
import { familyIcon, familyName } from "../Craft/familyName";
import { type IconOption, IconPicker } from "../IconPicker/IconPicker";
import { BRANCHES, type Branch, type TreePlace } from "./branches";

/** Journals stand for the crafting stations */
const BRANCH_ICONS: Record<Branch, string> = {
    WARRIOR: "T4_JOURNAL_WARRIOR_FULL",
    HUNTER: "T4_JOURNAL_HUNTER_FULL",
    MAGE: "T4_JOURNAL_MAGE_FULL",
    TOOLMAKER: "T4_JOURNAL_TOOLMAKER_FULL",
};

/** Station → group of items → item as rows of icons, like the old tree */
export const ItemPicker: React.FC<{
    families: ItemFamily[];
    places: ReadonlyMap<string, TreePlace>;
    names?: Names;
}> = ({ families, places, names }) => {
    const { t } = useTranslation();
    const { category, subcategory, family, select } = useTreeStore();
    // Saved before the tree had stations, `category` may hold a marketplace category
    const branch: Branch = BRANCHES.find((b) => b === category) ?? BRANCHES[0];
    const inBranch = families.filter((f) => places.get(f.key)?.branch === branch);
    const groupOf = (f: ItemFamily) => places.get(f.key)!.group;
    const groups = [...new Set(inBranch.map(groupOf))];
    const group = subcategory && groups.includes(subcategory) ? subcategory : groups[0];
    const items = inBranch.filter((f) => groupOf(f) === group);
    const selected = items.find((f) => f.key === family);
    const groupName = (id: string) => names?.categories[id] ?? id;

    // A row of one item: pick it right away instead of one more click
    const single = items.length === 1 ? items[0]!.key : undefined;

    useEffect(() => {
        if (single && single !== family) {
            select({ family: single, variant: 0 });
        }
    }, [single, family, select]);

    const branchOptions: IconOption<Branch>[] = BRANCHES.map((id) => ({
        id,
        icon: BRANCH_ICONS[id],
        label: t(`foundry.rows.${id}`),
    }));
    const groupOptions: IconOption<string>[] = groups.map((id) => ({
        id,
        icon: familyIcon(inBranch.find((f) => groupOf(f) === id)!),
        label: groupName(id),
    }));
    const itemOptions: IconOption<string>[] = items.map((f) => ({
        id: f.key,
        icon: familyIcon(f),
        label: familyName(f, names?.items),
    }));

    return (
        <div className="flex flex-col gap-2">
            <IconPicker
                label={t("tree.category")}
                options={branchOptions}
                value={branch}
                onChange={(category) => select({ category, subcategory: undefined })}
            />
            <IconPicker
                label={t("tree.subcategory")}
                options={groupOptions}
                value={group}
                onChange={(subcategory) => select({ subcategory })}
                size="sm"
            />
            <IconPicker
                label={t("tree.item")}
                options={itemOptions}
                value={family}
                onChange={(key) => select({ family: key, variant: 0 })}
            />
            <p className="text-sm text-muted">
                {[
                    t(`foundry.rows.${branch}`),
                    group && groupName(group),
                    selected && familyName(selected, names?.items),
                ]
                    .filter(Boolean)
                    .join(" › ")}
            </p>
        </div>
    );
};
