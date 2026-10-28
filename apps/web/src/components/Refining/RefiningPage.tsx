import { Alert, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { RefiningSettings } from "./RefiningSettings";
import { PriceBar } from "../PriceBar/PriceBar";
import { ProfitTable } from "../ProfitTable/ProfitTable";
import { ResourcePicker } from "./ResourcePicker";
import { useRefining } from "./useRefining";

export const RefiningPage: React.FC = () => {
    const { t } = useTranslation();
    const {
        cells,
        priceGroups,
        names,
        now,
        isCatalogPending,
        isPricesPending,
        isPricesFetching,
        pricesError,
    } = useRefining();

    return (
        <div className="flex flex-col gap-5">
            <h1 className="text-2xl font-semibold">♻️ {t("sections.refining")}</h1>
            <ResourcePicker />
            <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <RefiningSettings />
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-h-6 items-center gap-2 text-sm text-muted">
                        {isCatalogPending ? (
                            <>
                                <Spinner size="sm" /> {t("profit.loadingCatalog")}
                            </>
                        ) : isPricesPending || isPricesFetching ? (
                            <>
                                <Spinner size="sm" /> {t("profit.loadingPrices")}
                            </>
                        ) : (
                            t("profit.perUnit")
                        )}
                    </div>
                    {pricesError && (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Title>{t("profit.pricesError")}</Alert.Title>
                                <Alert.Description>
                                    {pricesError.message}
                                </Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}
                    {cells.length > 0 && (
                        <>
                            <PriceBar groups={priceGroups} names={names} />
                            <ProfitTable cells={cells} now={now} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
