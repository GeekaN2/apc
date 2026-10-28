import { type Catalog, type ItemFamily, familyRecipe, resourceMarketId } from "@apc/calc";
import { Alert, Label, Spinner, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { type Names, itemIconUrl } from "../../catalog/catalog";
import { PriceBar } from "../PriceBar/PriceBar";
import { ProfitTable } from "../ProfitTable/ProfitTable";
import { familyIcon, familyName } from "./familyName";
import type { useFamilyCraft } from "./useFamilyCraft";

/**
 * Recipe variants of a family, shown by what sets them apart: everything but
 * refined resources, e.g. an artifact or an Avalonian energy token
 */
const VariantPicker: React.FC<{
    catalog: Catalog;
    family: ItemFamily;
    variants: number;
    value: number;
    onChange: (variant: number) => void;
}> = ({ catalog, family, variants, value, onChange }) => {
    const { t } = useTranslation();
    const item =
        family.items.find((i) => i.craftingRequirements.length === variants) ??
        family.items[0]!;

    return (
        <div className="flex flex-col gap-1.5">
            <Label>{t("tree.recipe")}</Label>
            <ToggleButtonGroup
                aria-label={t("tree.recipe")}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[String(value)]}
                onSelectionChange={(keys) => {
                    const [key] = keys;

                    if (key !== undefined) {
                        onChange(Number(key));
                    }
                }}
                className="flex-wrap"
            >
                {Array.from({ length: variants }, (_, variant) => {
                    const ids = (familyRecipe(item, 0, variant)?.craftResource ?? [])
                        .map(resourceMarketId)
                        .filter(
                            (id) =>
                                catalog.item(id.split("@")[0]!)?.shopSubcategory1 !==
                                "refinedresources",
                        );

                    return (
                        <ToggleButton
                            key={variant}
                            id={String(variant)}
                            aria-label={`${t("tree.recipe")} ${variant + 1}`}
                            className="gap-1"
                        >
                            {ids.length > 0
                                ? ids.map((id) => (
                                      <img
                                          key={id}
                                          src={itemIconUrl(id, 40)}
                                          alt=""
                                          className="size-7"
                                      />
                                  ))
                                : variant + 1}
                        </ToggleButton>
                    );
                })}
            </ToggleButtonGroup>
        </div>
    );
};

/** The chosen family: its name, recipe variants, own prices and the profit table */
export const CraftResult: React.FC<{
    catalog: Catalog;
    family: ItemFamily;
    names?: Names;
    variants: number;
    variant: number;
    onVariantChange: (variant: number) => void;
    crafts: number;
    craft: ReturnType<typeof useFamilyCraft>;
}> = ({ catalog, family, names, variants, variant, onVariantChange, crafts, craft }) => {
    const { t } = useTranslation();
    const name = familyName(family, names?.items);

    return (
        <>
            <div className="flex items-center gap-3">
                <img
                    src={itemIconUrl(familyIcon(family), 64)}
                    alt=""
                    className="size-12"
                />
                <h2 className="text-xl font-medium">{name}</h2>
            </div>
            {variants > 1 && (
                <VariantPicker
                    catalog={catalog}
                    family={family}
                    variants={variants}
                    value={variant}
                    onChange={onVariantChange}
                />
            )}
            <div className="flex min-h-6 items-center gap-2 text-sm text-muted">
                {craft.isPricesFetching ? (
                    <>
                        <Spinner size="sm" /> {t("profit.loadingPrices")}
                    </>
                ) : (
                    t("profit.perCrafts", { count: crafts })
                )}
            </div>
            {craft.pricesError && (
                <Alert status="danger">
                    <Alert.Content>
                        <Alert.Title>{t("profit.pricesError")}</Alert.Title>
                        <Alert.Description>{craft.pricesError.message}</Alert.Description>
                    </Alert.Content>
                </Alert>
            )}
            <PriceBar groups={craft.priceGroups} names={names} />
            <ProfitTable cells={craft.cells} now={craft.now} name={name} />
        </>
    );
};
