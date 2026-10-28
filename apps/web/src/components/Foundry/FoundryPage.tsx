import { FRAGMENT_TYPES, type FoundryGroup } from "@apc/calc";
import { Alert, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { CRAFTING_CITIES, type Names, itemIconUrl } from "../../catalog/catalog";
import { useFoundryStore } from "../../store/foundry";
import { IconPicker } from "../IconPicker/IconPicker";
import { PriceBar } from "../PriceBar/PriceBar";
import {
    formatAge,
    formatNumber,
    formatPercent,
    formatSilver,
    isStale,
} from "../ProfitTable/format";
import { CitySelect, NumberInput, Toggle } from "../SettingsControls/SettingsControls";
import { type FoundryLine, TIERS, useFoundry } from "./useFoundry";

/** Journal icons stand for branches */
const ROW_ICONS: Partial<Record<string, string>> = {
    WARRIOR: "T4_JOURNAL_WARRIOR_FULL",
    HUNTER: "T4_JOURNAL_HUNTER_FULL",
    MAGE: "T4_JOURNAL_MAGE_FULL",
    TOOLMAKER: "T4_JOURNAL_TOOLMAKER_FULL",
};

function profitColor(profit: number | undefined): string {
    return profit === undefined
        ? "text-muted"
        : profit > 0
          ? "text-success"
          : "text-danger";
}

const FoundrySettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { settings, update, setCity } = useFoundryStore();
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
                        label={t("foundry.buyCity")}
                        value={cities.buy}
                        cities={CRAFTING_CITIES}
                        onChange={(city) => setCity("buy", city)}
                    />
                    <CitySelect
                        label={t("foundry.sellCity")}
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
            <Toggle
                label={t("profit.ownReturnRate")}
                isSelected={settings.ownReturnRate !== undefined}
                onChange={(on) => update({ ownReturnRate: on ? 15.2 : undefined })}
            />
            {settings.ownReturnRate !== undefined && (
                <NumberInput
                    label={t("profit.returnRate")}
                    value={settings.ownReturnRate}
                    onChange={(ownReturnRate) => update({ ownReturnRate })}
                    maxValue={99}
                    step={0.1}
                />
            )}
        </section>
    );
};

/** Artifacts of the selected cell, the most profitable first */
const Details: React.FC<{
    title: string;
    group: FoundryGroup & { artifacts: FoundryLine[] };
    names?: Names;
    now: number;
}> = ({ title, group, names, now }) => {
    const { t, i18n } = useTranslation();
    const silver = (value: number) => formatSilver(value, i18n.language);
    const { stats } = group;
    const lines = [...group.artifacts, ...(group.unpriced as FoundryLine[])];

    return (
        <section className="flex flex-col gap-3 rounded-xl border border-separator p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="font-medium">{title}</h2>
                {stats && (
                    <p className="text-sm text-muted tabular-nums">
                        {t("foundry.mean")} {silver(stats.mean)} · {t("foundry.median")}{" "}
                        {silver(stats.median)} · {t("foundry.spread")} ±
                        {silver(stats.standardDeviation)} ·{" "}
                        {t("foundry.count", { count: stats.count })}
                        {group.unpriced.length > 0 &&
                            `, ${t("foundry.unpriced", { count: group.unpriced.length })}`}
                    </p>
                )}
            </div>
            <ul className="flex flex-col">
                {lines.map((line) => {
                    const { profit, profitPercentage } = line.result;
                    const name = names?.items[line.marketId] ?? line.marketId;

                    return (
                        <li
                            key={line.marketId}
                            className="flex items-center gap-3 border-b border-separator py-1.5 text-sm last:border-0"
                        >
                            <img
                                src={itemIconUrl(line.marketId, 40)}
                                alt=""
                                loading="lazy"
                                className="size-9 shrink-0"
                            />
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate" title={name}>
                                    {name}
                                </span>
                                <span className="text-xs whitespace-nowrap text-muted tabular-nums">
                                    {line.sale ? (
                                        <>
                                            {silver(line.sale.price)} ·{" "}
                                            <span
                                                className={
                                                    isStale(line.sale.date, now)
                                                        ? "text-danger"
                                                        : undefined
                                                }
                                            >
                                                {formatAge(
                                                    line.sale.date,
                                                    now,
                                                    i18n.language,
                                                )}
                                            </span>
                                        </>
                                    ) : (
                                        t("profit.noPrices")
                                    )}
                                    {line.soldPerDay !== undefined &&
                                        ` · ${formatNumber(line.soldPerDay, i18n.language, 0)}/${t("foundry.day")}`}
                                </span>
                            </div>
                            <div className="flex flex-col items-end whitespace-nowrap tabular-nums">
                                <span className={`font-medium ${profitColor(profit)}`}>
                                    {profit === undefined ? "—" : silver(profit)}
                                </span>
                                {profitPercentage !== undefined && (
                                    <span className={`text-xs ${profitColor(profit)}`}>
                                        {formatPercent(profitPercentage, i18n.language)}%
                                    </span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export const FoundryPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { fragment, cell, select } = useFoundryStore();
    const foundry = useFoundry();
    const selected = cell && foundry.group(cell.row, cell.tier);

    return (
        <div className="flex flex-col gap-5">
            <h1 className="text-2xl font-semibold">🗿 {t("sections.artifactFoundry")}</h1>
            <div className="flex flex-col gap-1">
                <IconPicker
                    label={t("tree.item")}
                    options={FRAGMENT_TYPES.map((id) => ({
                        id,
                        icon: `T4_${id}`,
                        label: t(`foundry.fragments.${id}`),
                    }))}
                    value={fragment}
                    onChange={(fragment) => select({ fragment, cell: undefined })}
                />
                <p className="text-sm text-muted">{t(`foundry.fragments.${fragment}`)}</p>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <FoundrySettingsPanel />
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex min-h-6 items-center gap-2 text-sm text-muted">
                        {foundry.isCatalogPending ? (
                            <>
                                <Spinner size="sm" /> {t("profit.loadingCatalog")}
                            </>
                        ) : foundry.isPricesFetching ? (
                            <>
                                <Spinner size="sm" /> {t("profit.loadingPrices")}
                            </>
                        ) : (
                            t("foundry.hint")
                        )}
                    </div>
                    {foundry.pricesError && (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Title>{t("profit.pricesError")}</Alert.Title>
                                <Alert.Description>
                                    {foundry.pricesError.message}
                                </Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}
                    {foundry.rows.length > 0 && (
                        <>
                            <PriceBar
                                groups={foundry.priceGroups}
                                names={foundry.names}
                            />
                            <div className="overflow-x-auto rounded-xl border border-separator">
                                <table className="w-full border-collapse text-sm whitespace-nowrap">
                                    <thead>
                                        <tr className="border-b border-separator text-muted">
                                            <th className="px-3 py-2 text-left font-normal">
                                                {t("foundry.branch")}
                                            </th>
                                            {/* Cells are p-1 around a px-3 button: 16px on the right as here */}
                                            {TIERS.map((tier) => (
                                                <th
                                                    key={tier}
                                                    className="py-2 ps-3 pe-4 text-right font-medium"
                                                >
                                                    T{tier}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {foundry.rows.map((row) => (
                                            <tr
                                                key={row}
                                                className="border-b border-separator last:border-0"
                                            >
                                                <th className="px-3 py-2 text-left font-medium">
                                                    <span className="flex items-center gap-2">
                                                        {ROW_ICONS[row] && (
                                                            <img
                                                                src={itemIconUrl(
                                                                    ROW_ICONS[row],
                                                                    32,
                                                                )}
                                                                alt=""
                                                                className="size-6"
                                                            />
                                                        )}
                                                        {t(`foundry.rows.${row}`)}
                                                    </span>
                                                </th>
                                                {TIERS.map((tier) => {
                                                    const group = foundry.group(
                                                        row,
                                                        tier,
                                                    );
                                                    const mean = group?.stats?.mean;
                                                    const active =
                                                        cell?.row === row &&
                                                        cell.tier === tier;

                                                    return (
                                                        <td key={tier} className="p-1">
                                                            <button
                                                                type="button"
                                                                aria-pressed={active}
                                                                onClick={() =>
                                                                    select({
                                                                        cell: active
                                                                            ? undefined
                                                                            : {
                                                                                  row,
                                                                                  tier,
                                                                              },
                                                                    })
                                                                }
                                                                className={`flex w-full flex-col items-end rounded-md px-3 py-2 tabular-nums focus-visible:outline-2 ${
                                                                    active
                                                                        ? "bg-accent-soft"
                                                                        : "hover:bg-default"
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`font-medium ${profitColor(mean)}`}
                                                                >
                                                                    {mean === undefined
                                                                        ? "—"
                                                                        : formatSilver(
                                                                              mean,
                                                                              i18n.language,
                                                                          )}
                                                                </span>
                                                                {group?.meanPercentage !==
                                                                    undefined && (
                                                                    <span
                                                                        className={`text-xs ${profitColor(mean)}`}
                                                                    >
                                                                        {formatPercent(
                                                                            group.meanPercentage,
                                                                            i18n.language,
                                                                        )}
                                                                        %
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                    {cell && selected && (
                        <Details
                            title={`T${cell.tier} · ${t(`foundry.rows.${cell.row}` as "foundry.rows.ALL")}`}
                            group={selected}
                            names={foundry.names}
                            now={foundry.now}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
