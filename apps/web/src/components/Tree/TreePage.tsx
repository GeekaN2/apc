import { type Catalog, type ItemFamily, familyRecipe, resourceMarketId } from "@apc/calc";
import { Alert, Label, Spinner, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { itemIconUrl } from "../../catalog/catalog";
import { useTreeStore } from "../../store/tree";
import { useTreeSettingsSync } from "../../store/useTreeSettingsSync";
import { ProfitTable } from "../ProfitTable/ProfitTable";
import { ItemPicker } from "./ItemPicker";
import { TreeSettingsPanel } from "./TreeSettingsPanel";
import { familyName, useTree } from "./useTree";

/**
 * Recipe variants of a family, shown by what sets them apart: everything but
 * refined resources, e.g. an artifact or an Avalonian energy token
 */
const VariantPicker: React.FC<{
    catalog: Catalog;
    family: ItemFamily;
    variants: number;
    value: number;
}> = ({ catalog, family, variants, value }) => {
    const { t } = useTranslation();
    const select = useTreeStore((state) => state.select);
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
                        select({ variant: Number(key) });
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

export const TreePage: React.FC = () => {
    const { t } = useTranslation();
    const tree = useTree();
    const crafts = useTreeStore((state) => state.settings.crafts);

    useTreeSettingsSync();

    return (
        <div className="flex flex-col gap-5">
            <h1 className="text-2xl font-semibold">🌳 {t("sections.profitTree")}</h1>
            {tree.isCatalogPending ? (
                <div className="flex items-center gap-2 text-sm text-muted">
                    <Spinner size="sm" /> {t("profit.loadingCatalog")}
                </div>
            ) : (
                <ItemPicker families={tree.families} names={tree.names} />
            )}
            <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <TreeSettingsPanel />
                <div className="flex min-w-0 flex-col gap-3">
                    {tree.family && tree.catalog ? (
                        <>
                            <div className="flex items-center gap-3">
                                <img
                                    src={itemIconUrl(
                                        (
                                            tree.family.items.find((i) => i.tier === 4) ??
                                            tree.family.items[0]!
                                        ).uniqueName,
                                        64,
                                    )}
                                    alt=""
                                    className="size-12"
                                />
                                <h2 className="text-xl font-medium">
                                    {familyName(tree.family, tree.names?.items)}
                                </h2>
                            </div>
                            {tree.variants > 1 && (
                                <VariantPicker
                                    catalog={tree.catalog}
                                    family={tree.family}
                                    variants={tree.variants}
                                    value={tree.recipeVariant}
                                />
                            )}
                            <div className="flex min-h-6 items-center gap-2 text-sm text-muted">
                                {tree.isPricesFetching ? (
                                    <>
                                        <Spinner size="sm" /> {t("profit.loadingPrices")}
                                    </>
                                ) : (
                                    t("profit.perCrafts", { count: crafts })
                                )}
                            </div>
                            {tree.pricesError && (
                                <Alert status="danger">
                                    <Alert.Content>
                                        <Alert.Title>
                                            {t("profit.pricesError")}
                                        </Alert.Title>
                                        <Alert.Description>
                                            {tree.pricesError.message}
                                        </Alert.Description>
                                    </Alert.Content>
                                </Alert>
                            )}
                            <ProfitTable
                                cells={tree.cells}
                                now={tree.now}
                                name={familyName(tree.family, tree.names?.items)}
                            />
                        </>
                    ) : (
                        !tree.isCatalogPending && (
                            <p className="text-muted">{t("tree.chooseItem")}</p>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
