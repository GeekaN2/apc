import { EQUIPMENT_CATEGORIES, type ItemFamily } from "@apc/calc";
import { ToggleButton, ToggleButtonGroup, Tooltip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { type Names, itemIconUrl } from "../../catalog/catalog";
import { useTreeStore } from "../../store/tree";
import { familyName } from "./useTree";

function uniq<T>(values: T[]): T[] {
    return [...new Set(values)];
}

/** Single selection over toggle buttons */
function Choice<T extends string>({
    label,
    value,
    options,
    onChange,
    render,
}: {
    label: string;
    value: T | undefined;
    options: readonly T[];
    onChange: (value: T) => void;
    render: (value: T) => React.ReactNode;
}) {
    return (
        <ToggleButtonGroup
            aria-label={label}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={value ? [value] : []}
            onSelectionChange={(keys) => {
                const [key] = keys;

                if (key) {
                    onChange(key as T);
                }
            }}
            className="flex-wrap"
        >
            {options.map((option) => (
                <ToggleButton key={option} id={option} size="sm">
                    {render(option)}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

/** Category → subcategory → item, by the marketplace tree */
export const ItemPicker: React.FC<{ families: ItemFamily[]; names?: Names }> = ({
    families,
    names,
}) => {
    const { t } = useTranslation();
    const { category, subcategory, family, select } = useTreeStore();
    const categoryName = (id: string) => names?.categories[id] ?? id;
    const inCategory = families.filter((f) => f.shopCategory === category);
    const subcategories = uniq(inCategory.map((f) => f.shopSubcategory1));
    const currentSubcategory =
        subcategory && subcategories.includes(subcategory)
            ? subcategory
            : subcategories[0];
    const items = inCategory.filter((f) => f.shopSubcategory1 === currentSubcategory);

    return (
        <div className="flex flex-col gap-3">
            <Choice
                label={t("tree.category")}
                value={category}
                options={EQUIPMENT_CATEGORIES}
                onChange={(category) => select({ category, subcategory: undefined })}
                render={categoryName}
            />
            {subcategories.length > 1 && (
                <Choice
                    label={t("tree.subcategory")}
                    value={currentSubcategory}
                    options={subcategories}
                    onChange={(subcategory) => select({ subcategory })}
                    render={categoryName}
                />
            )}
            <div
                role="listbox"
                aria-label={t("tree.item")}
                className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1"
            >
                {items.map((f) => {
                    const name = familyName(f, names?.items);
                    const icon = (f.items.find((i) => i.tier === 4) ?? f.items[0]!)
                        .uniqueName;
                    const selected = f.key === family;

                    return (
                        <Tooltip key={f.key} delay={300} closeDelay={0}>
                            <Tooltip.Trigger>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    aria-label={name}
                                    onClick={() => select({ family: f.key, variant: 0 })}
                                    className={`flex aspect-square w-full items-center justify-center rounded-lg border p-1 transition-colors ${
                                        selected
                                            ? "border-accent bg-accent-soft"
                                            : "border-transparent hover:bg-default"
                                    }`}
                                >
                                    <img
                                        src={itemIconUrl(icon, 64)}
                                        alt=""
                                        loading="lazy"
                                        className="size-14"
                                    />
                                </button>
                            </Tooltip.Trigger>
                            <Tooltip.Content className="max-w-none break-normal whitespace-nowrap">
                                {name}
                            </Tooltip.Content>
                        </Tooltip>
                    );
                })}
            </div>
        </div>
    );
};
