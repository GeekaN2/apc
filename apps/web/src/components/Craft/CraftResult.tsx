import {
    type Catalog,
    type ItemFamily,
    enchantmentLevels,
    familyRecipe,
    resourceMarketId,
} from "@apc/calc";
import { Alert, Label, Spinner, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { type Names, itemIconProps } from "../../catalog/catalog";
import { formatRecipeAmount, summarizeRecipeAmounts } from "../../catalog/recipeAmounts";
import { PriceBar } from "../PriceBar/PriceBar";
import { ProfitTable } from "../ProfitTable/ProfitTable";
import { RecipeIcon } from "../RecipeIcon/RecipeIcon";
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
    crafts: number;
    names?: Names;
    onChange: (variant: number) => void;
}> = ({ catalog, family, variants, value, crafts, names, onChange }) => {
    const { t, i18n } = useTranslation();

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
                    const recipes = family.items.flatMap((item) =>
                        enchantmentLevels(item).map((level) =>
                            (familyRecipe(item, level, variant)?.craftResource ?? [])
                                .filter(
                                    (resource) =>
                                        catalog.item(resource.uniqueName)
                                            ?.shopSubcategory1 !== "refinedresources",
                                )
                                .map((resource) => ({
                                    marketId: resourceMarketId(resource),
                                    count: resource.count * crafts,
                                })),
                        ),
                    );
                    const ingredients = [...summarizeRecipeAmounts(recipes).values()];

                    return (
                        <ToggleButton
                            key={variant}
                            id={String(variant)}
                            aria-label={`${t("tree.recipe")} ${variant + 1}`}
                            className="h-auto gap-1 py-1"
                        >
                            {ingredients.length > 0
                                ? ingredients.map((ingredient) => (
                                      <RecipeIcon
                                          key={ingredient.marketId}
                                          marketId={ingredient.marketId}
                                          name={names?.items[ingredient.marketId]}
                                          amount={formatRecipeAmount(
                                              ingredient,
                                              i18n.language,
                                          )}
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
                <img {...itemIconProps(familyIcon(family))} alt="" className="size-12" />
                <h2 className="text-xl font-medium">{name}</h2>
            </div>
            {variants > 1 && (
                <VariantPicker
                    catalog={catalog}
                    family={family}
                    variants={variants}
                    value={variant}
                    crafts={crafts}
                    names={names}
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
            <PriceBar
                groups={craft.priceGroups}
                names={names}
                recipes={craft.cells.map(({ result }) => result.resources)}
            />
            <ProfitTable cells={craft.cells} now={craft.now} name={name} />
        </>
    );
};
