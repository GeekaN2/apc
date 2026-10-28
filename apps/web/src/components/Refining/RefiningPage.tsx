import { Alert, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { RefiningSettings } from "./RefiningSettings";
import { RefiningTable } from "./RefiningTable";
import { ResourcePicker } from "./ResourcePicker";
import { useRefining } from "./useRefining";

export const RefiningPage: React.FC = () => {
    const { t } = useTranslation();
    const {
        cells,
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
                                <Spinner size="sm" /> {t("refining.loadingCatalog")}
                            </>
                        ) : isPricesPending || isPricesFetching ? (
                            <>
                                <Spinner size="sm" /> {t("refining.loadingPrices")}
                            </>
                        ) : (
                            t("refining.perUnit")
                        )}
                    </div>
                    {pricesError && (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Title>{t("refining.pricesError")}</Alert.Title>
                                <Alert.Description>
                                    {pricesError.message}
                                </Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}
                    {cells.length > 0 && <RefiningTable cells={cells} now={now} />}
                </div>
            </div>
        </div>
    );
};
