import { EQUIPMENT_CATEGORIES, type ItemFamily } from "@apc/calc";
import { useTranslation } from "react-i18next";
import { CRAFTING_CITIES, type CraftingCity, type Names } from "../../catalog/catalog";
import { useTreeStore } from "../../store/tree";
import { type IconOption, IconPicker } from "../IconPicker/IconPicker";
import { familyName } from "./useTree";

/** A typical item of each category for its icon */
const CATEGORY_ICONS: Record<(typeof EQUIPMENT_CATEGORIES)[number], string> = {
    weapons: "T4_MAIN_SWORD",
    armors: "T4_ARMOR_PLATE_SET1",
    head: "T4_HEAD_PLATE_SET1",
    shoes: "T4_SHOES_PLATE_SET1",
    offhands: "T4_OFF_SHIELD",
    capes: "T4_CAPE",
    bags: "T4_BAG",
    gathering: "T4_2H_TOOL_PICK",
};

/** City capes have no names in the dumps: `accessoires_capes_fortsterling` */
function capeCity(id: string, name: (city: CraftingCity) => string): string | undefined {
    const city = CRAFTING_CITIES.find(
        (c) => id === `accessoires_capes_${c.toLowerCase().replace(" ", "")}`,
    );

    return city && name(city);
}

function iconOf(family: ItemFamily): string {
    return (family.items.find((item) => item.tier === 4) ?? family.items[0]!).uniqueName;
}

/** Category → subcategory → item as rows of icons, like the old tree */
export const ItemPicker: React.FC<{ families: ItemFamily[]; names?: Names }> = ({
    families,
    names,
}) => {
    const { t } = useTranslation();
    const { category, subcategory, family, select } = useTreeStore();
    const categoryName = (id: string) =>
        names?.categories[id] ?? capeCity(id, (city) => t(`cities.${city}`)) ?? id;
    const inCategory = families.filter((f) => f.shopCategory === category);
    const subcategories = [...new Set(inCategory.map((f) => f.shopSubcategory1))];
    const currentSubcategory =
        subcategory && subcategories.includes(subcategory)
            ? subcategory
            : subcategories[0];
    const items = inCategory.filter((f) => f.shopSubcategory1 === currentSubcategory);
    const selected = items.find((f) => f.key === family);

    const categoryOptions: IconOption<string>[] = EQUIPMENT_CATEGORIES.map((id) => ({
        id,
        icon: CATEGORY_ICONS[id],
        label: categoryName(id),
    }));
    const subcategoryOptions: IconOption<string>[] = subcategories.map((id) => ({
        id,
        icon: iconOf(inCategory.find((f) => f.shopSubcategory1 === id)!),
        label: categoryName(id),
    }));
    const itemOptions: IconOption<string>[] = items.map((f) => ({
        id: f.key,
        icon: iconOf(f),
        label: familyName(f, names?.items),
    }));

    return (
        <div className="flex flex-col gap-2">
            <IconPicker
                label={t("tree.category")}
                options={categoryOptions}
                value={category}
                onChange={(category) => select({ category, subcategory: undefined })}
            />
            {subcategoryOptions.length > 1 && (
                <IconPicker
                    label={t("tree.subcategory")}
                    options={subcategoryOptions}
                    value={currentSubcategory}
                    onChange={(subcategory) => select({ subcategory })}
                    size="sm"
                />
            )}
            <IconPicker
                label={t("tree.item")}
                options={itemOptions}
                value={family}
                onChange={(key) => select({ family: key, variant: 0 })}
            />
            <p className="text-sm text-muted">
                {[
                    categoryName(category),
                    currentSubcategory && categoryName(currentSubcategory),
                    selected && familyName(selected, names?.items),
                ]
                    .filter(Boolean)
                    .join(" › ")}
            </p>
        </div>
    );
};
