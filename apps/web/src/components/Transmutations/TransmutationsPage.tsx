import {
    type TransmutationTarget,
    bestTransmutations,
    calibrateSilverFactor,
    itemMarketId,
    transmutableResources,
    transmutationRecipes,
} from "@apc/calc";
import { Alert, Spinner } from "@heroui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePrices } from "../../api/prices";
import {
    CRAFTING_CITIES,
    type Names,
    itemIconUrl,
    useNames,
    useResourceCatalog,
} from "../../catalog/catalog";
import {
    type PriceGroup,
    type SalePrice,
    type UsedPrice,
    createPriceBook,
} from "../../prices/priceBook";
import { useManualPrices } from "../../store/manualPrices";
import { TRANSMUTED_RESOURCES, useTransmutationStore } from "../../store/transmutations";
import { IconPicker } from "../IconPicker/IconPicker";
import { PriceBar } from "../PriceBar/PriceBar";
import { Line, PriceAge, ProfitButton, TierGrid } from "../ProfitTable/ProfitTable";
import { formatNumber, formatSilver } from "../ProfitTable/format";
import { CitySelect, NumberInput, Toggle } from "../SettingsControls/SettingsControls";

/** The recipe the game cost is calibrated by */
const CALIBRATION_ITEM = "T4_ORE_LEVEL4";

interface Cell extends TransmutationTarget {
    tier: number;
    enchantmentLevel: number;
    sale?: SalePrice;
    bought?: UsedPrice;
}

const Details: React.FC<{ cell: Cell; names?: Names; now: number }> = ({
    cell,
    names,
    now,
}) => {
    const { t, i18n } = useTranslation();
    const silver = (value: number) => formatSilver(value, i18n.language);
    const { best } = cell;
    const priced = (price: UsedPrice | undefined) =>
        price ? (
            <>
                {silver(price.price)} ·{" "}
                {price.manual ? (
                    <span className="text-accent">{t("prices.own")}</span>
                ) : (
                    <PriceAge date={price.date} now={now} />
                )}
            </>
        ) : (
            <span className="text-danger">{t("profit.noPrices")}</span>
        );
    const name = (id: string) => names?.items[id] ?? id;

    return (
        <div className="flex flex-col gap-1.5 text-sm">
            <div className="font-medium whitespace-nowrap">
                {name(itemMarketId(cell.item))}
            </div>
            <Line
                icon={itemMarketId(cell.item)}
                label={`${t("profit.sale")} (${
                    cell.sale?.kind === "buyOrder"
                        ? t("profit.saleBuyOrder")
                        : t("profit.saleSellOrder")
                })`}
                value={priced(cell.sale)}
            />
            {best && (
                <>
                    <Line label={t("profit.income")} value={silver(best.income)} />
                    <Line
                        icon={itemMarketId(best.source)}
                        label={t("transmutations.buy")}
                        value={priced(cell.bought)}
                    />
                    <Line
                        label={`${t("transmutations.transmute")}, ${t(
                            "transmutations.steps",
                            {
                                count: best.path.steps.length,
                            },
                        )}`}
                        value={silver(best.path.cost)}
                    />
                    <div className="flex items-center gap-0.5 py-1">
                        {[
                            best.source.uniqueName,
                            ...best.path.steps.map((s) => s.to),
                        ].map((id, index) => (
                            <span key={id} className="flex items-center gap-0.5">
                                {index > 0 && <span className="text-muted">→</span>}
                                <img
                                    src={itemIconUrl(toMarketId(id), 32)}
                                    alt=""
                                    title={name(toMarketId(id))}
                                    className="size-7"
                                />
                            </span>
                        ))}
                    </div>
                    <Line label={t("profit.cost")} value={silver(best.cost)} />
                    <Line
                        label={<strong>{t("profit.profit")}</strong>}
                        value={<strong>{silver(best.profit)}</strong>}
                    />
                </>
            )}
        </div>
    );
};

/** `T5_ORE_LEVEL2` → `T5_ORE_LEVEL2@2` */
function toMarketId(uniqueName: string): string {
    const level = /_LEVEL(\d)$/.exec(uniqueName)?.[1];

    return level ? `${uniqueName}@${level}` : uniqueName;
}

const SettingsPanel: React.FC<{ factor: number }> = ({ factor }) => {
    const { t, i18n } = useTranslation();
    const { settings, update, setCity } = useTransmutationStore();
    const { cities } = settings;

    return (
        <section className="flex flex-col gap-4" aria-label={t("profit.settings")}>
            <Toggle
                label={t("profit.sameCity")}
                isSelected={settings.sameCity}
                onChange={(sameCity) => {
                    update({ sameCity });

                    if (sameCity) {
                        setCity("sell", cities.sell);
                    }
                }}
            />
            {settings.sameCity ? (
                <CitySelect
                    label={t("profit.city")}
                    value={cities.sell}
                    cities={CRAFTING_CITIES}
                    onChange={(city) => setCity("sell", city)}
                />
            ) : (
                <>
                    <CitySelect
                        label={t("transmutations.buyCity")}
                        value={cities.buy}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("buy", city)}
                    />
                    <CitySelect
                        label={t("transmutations.sellCity")}
                        value={cities.sell}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("sell", city)}
                    />
                </>
            )}
            <Toggle
                label={t("profit.premium")}
                isSelected={settings.premium}
                onChange={(premium) => update({ premium })}
            />
            <NumberInput
                label={t("profit.fee")}
                value={settings.fee}
                onChange={(fee) => update({ fee })}
                step={50}
            />
            <div className="flex flex-col gap-1">
                <NumberInput
                    label={t("transmutations.observedCost")}
                    value={settings.observedCost ?? 0}
                    onChange={(cost) =>
                        update({ observedCost: cost > 0 ? cost : undefined })
                    }
                    step={500}
                />
                <p className="text-xs text-muted">
                    {t("transmutations.observedHint")}{" "}
                    {t("transmutations.discount", {
                        factor: formatNumber(factor, i18n.language, 3),
                    })}
                </p>
            </div>
        </section>
    );
};

export const TransmutationsPage: React.FC = () => {
    const { t } = useTranslation();
    const { resource, settings, select } = useTransmutationStore();
    const catalog = useResourceCatalog();
    const names = useNames();
    const manual = useManualPrices();
    const marketIds = useMemo(
        () =>
            catalog.data
                ? transmutableResources(catalog.data, resource).map((item) =>
                      itemMarketId(item),
                  )
                : [],
        [catalog.data, resource],
    );
    const { buy, sell } = settings.cities;
    const prices = usePrices(marketIds, [buy, sell]);
    const quotes = prices.data;
    const now = prices.dataUpdatedAt;

    const factor = useMemo(() => {
        const item = catalog.data?.item(CALIBRATION_ITEM);
        const recipe = item && transmutationRecipes(item)[0];

        return catalog.data && item && recipe && settings.observedCost
            ? calibrateSilverFactor(catalog.data, item, recipe, {
                  observedCost: settings.observedCost,
                  feePer100Nutrition: settings.fee,
              })
            : 1;
    }, [catalog.data, settings.observedCost, settings.fee]);

    const { cells, priceGroups } = useMemo(() => {
        const data = catalog.data;

        if (!data) {
            return { cells: [] as Cell[], priceGroups: [] as PriceGroup[] };
        }

        const book = createPriceBook({
            quotes,
            manual,
            marketPlace: data.constants.marketPlace,
            premium: settings.premium,
            now,
        });
        const cells: Cell[] = bestTransmutations({
            catalog: data,
            resource,
            silverFactor: factor,
            feePer100Nutrition: settings.fee,
            premium: settings.premium,
            buyPrice: (marketId) => book.buy(marketId, buy)?.price,
            sale: (marketId) => book.sell(marketId, sell) ?? { kind: "sellOrder" },
        }).map((target) => ({
            ...target,
            tier: target.item.tier,
            enchantmentLevel: target.item.enchantmentLevel ?? 0,
            sale: book.sell(itemMarketId(target.item), sell),
            bought: target.best && book.buy(itemMarketId(target.best.source), buy),
        }));
        const priceGroups: PriceGroup[] = [
            {
                key: "raw",
                rows: marketIds.map((marketId) => ({
                    marketId,
                    market: book.marketBuy(marketId, buy),
                })),
            },
        ];

        return { cells, priceGroups };
    }, [
        catalog.data,
        quotes,
        manual,
        now,
        resource,
        factor,
        settings,
        buy,
        sell,
        marketIds,
    ]);

    return (
        <div className="flex flex-col gap-5">
            <h1 className="text-2xl font-semibold">🧪 {t("sections.transmutations")}</h1>
            <div className="flex flex-col gap-1">
                <IconPicker
                    label={t("refining.resource")}
                    options={TRANSMUTED_RESOURCES.map((id) => ({
                        id,
                        icon: `T4_${id}`,
                        label: t(`transmutations.resources.${id}`),
                    }))}
                    value={resource}
                    onChange={select}
                />
                <p className="text-sm text-muted">
                    {t(`transmutations.resources.${resource}`)}
                </p>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <SettingsPanel factor={factor} />
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-h-6 items-center gap-2 text-sm text-muted">
                        {catalog.isPending ? (
                            <>
                                <Spinner size="sm" /> {t("profit.loadingCatalog")}
                            </>
                        ) : prices.isFetching ? (
                            <>
                                <Spinner size="sm" /> {t("profit.loadingPrices")}
                            </>
                        ) : (
                            t("transmutations.hint")
                        )}
                    </div>
                    {prices.error && (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Title>{t("profit.pricesError")}</Alert.Title>
                                <Alert.Description>
                                    {prices.error.message}
                                </Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}
                    {cells.length > 0 && (
                        <>
                            <PriceBar groups={priceGroups} names={names.data} />
                            <TierGrid
                                cells={cells}
                                renderCell={(cell) => (
                                    <ProfitButton
                                        profit={cell.best?.profit}
                                        percentage={cell.best?.profitPercentage}
                                        details={
                                            <Details
                                                cell={cell}
                                                names={names.data}
                                                now={now}
                                            />
                                        }
                                    />
                                )}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
