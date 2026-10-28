import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { useTreeStore } from "../../store/tree";
import { useTreeSettingsSync } from "../../store/useTreeSettingsSync";
import { CraftResult } from "../Craft/CraftResult";
import { ItemPicker } from "./ItemPicker";
import { TreeSettingsPanel } from "./TreeSettingsPanel";
import { useTree } from "./useTree";

export const TreePage: React.FC = () => {
    const { t } = useTranslation();
    const tree = useTree();
    const crafts = useTreeStore((state) => state.settings.crafts);
    const select = useTreeStore((state) => state.select);

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
                        <CraftResult
                            catalog={tree.catalog}
                            family={tree.family}
                            names={tree.names}
                            variants={tree.variants}
                            variant={tree.recipeVariant}
                            onVariantChange={(variant) => select({ variant })}
                            crafts={crafts}
                            craft={tree}
                        />
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
