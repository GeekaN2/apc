import { Tooltip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { itemIconUrl } from "../../catalog/catalog";
import { formatAge, formatPercent, formatSilver, isStale } from "./format";
import type { RefiningCell, UsedPrice } from "./useRefining";

const PriceAge: React.FC<{ date: Date; now: number }> = ({ date, now }) => {
    const { t, i18n } = useTranslation();
    const stale = isStale(date, now);

    return (
        <span
            className={stale ? "text-danger" : "text-muted"}
            title={stale ? t("refining.stale") : undefined}
        >
            {formatAge(date, now, i18n.language)}
        </span>
    );
};

const Line: React.FC<{
    icon?: string;
    label: React.ReactNode;
    value: React.ReactNode;
}> = ({ icon, label, value }) => (
    <div className="flex items-center justify-between gap-6 whitespace-nowrap">
        <span className="flex items-center gap-1.5">
            {icon && <img src={itemIconUrl(icon, 32)} alt="" className="size-6" />}
            {label}
        </span>
        <span className="tabular-nums">{value}</span>
    </div>
);

/** How the profit of a cell is made up */
const Breakdown: React.FC<{ cell: RefiningCell; now: number }> = ({ cell, now }) => {
    const { t, i18n } = useTranslation();
    const silver = (value: number) => formatSilver(value, i18n.language);
    const { result, sale } = cell;
    const rate = formatPercent(cell.returnRate * 100, i18n.language).replace("+", "");
    const priceOf = (price: UsedPrice | undefined) =>
        price ? (
            <>
                {silver(price.price)} · <PriceAge date={price.date} now={now} />
            </>
        ) : (
            <span className="text-danger">{t("refining.noPrices")}</span>
        );

    return (
        <div className="flex flex-col gap-1.5 text-sm">
            <Line
                icon={cell.marketId}
                label={`${t("refining.sale")} (${
                    sale?.kind === "buyOrder"
                        ? t("refining.saleBuyOrder")
                        : t("refining.saleSellOrder")
                })`}
                value={priceOf(sale && sale.price > 0 ? sale : undefined)}
            />
            {result.income !== undefined && (
                <Line label={t("refining.income")} value={silver(result.income)} />
            )}
            {result.resources.map((line) => (
                <Line
                    key={line.marketId}
                    icon={line.marketId}
                    label={`× ${line.count}${
                        line.returned ? `, ${t("refining.returned", { rate })}` : ""
                    }`}
                    value={
                        <>
                            {priceOf(cell.buyPrices.get(line.marketId))}
                            {line.cost !== undefined && <> → {silver(line.cost)}</>}
                        </>
                    }
                />
            ))}
            <Line label={t("refining.stationFee")} value={silver(result.stationFee)} />
            {cell.focus !== undefined && (
                <Line label={t("refining.focusCost")} value={silver(cell.focus)} />
            )}
            {result.cost !== undefined && (
                <Line label={t("refining.cost")} value={silver(result.cost)} />
            )}
            {result.profit !== undefined && (
                <Line
                    label={<strong>{t("refining.profit")}</strong>}
                    value={<strong>{silver(result.profit)}</strong>}
                />
            )}
        </div>
    );
};

const ProfitCell: React.FC<{ cell: RefiningCell; now: number }> = ({ cell, now }) => {
    const { t, i18n } = useTranslation();
    const { profit, profitPercentage } = cell.result;
    const color =
        profit === undefined ? "text-muted" : profit > 0 ? "text-success" : "text-danger";

    return (
        <Tooltip delay={150} closeDelay={0}>
            <Tooltip.Trigger>
                <button
                    type="button"
                    className="flex w-full flex-col items-end rounded-md px-3 py-2 whitespace-nowrap tabular-nums hover:bg-default focus-visible:outline-2"
                >
                    <span className={`font-medium ${color}`}>
                        {profit === undefined ? (
                            <span aria-label={t("refining.noPrices")}>—</span>
                        ) : (
                            formatSilver(profit, i18n.language)
                        )}
                    </span>
                    {profitPercentage !== undefined && (
                        <span className={`text-xs ${color}`}>
                            {formatPercent(profitPercentage, i18n.language)}%
                        </span>
                    )}
                </button>
            </Tooltip.Trigger>
            <Tooltip.Content placement="bottom" className="max-w-none break-normal">
                <Breakdown cell={cell} now={now} />
            </Tooltip.Content>
        </Tooltip>
    );
};

export const RefiningTable: React.FC<{ cells: RefiningCell[]; now: number }> = ({
    cells,
    now,
}) => {
    const { t } = useTranslation();
    const tiers = [...new Set(cells.map((cell) => cell.tier))].sort((a, b) => a - b);
    const levels = [...new Set(cells.map((cell) => cell.enchantmentLevel))].sort(
        (a, b) => a - b,
    );
    const cellAt = (tier: number, level: number) =>
        cells.find((cell) => cell.tier === tier && cell.enchantmentLevel === level);

    return (
        <div className="overflow-x-auto rounded-xl border border-separator">
            <table className="w-full border-collapse text-sm whitespace-nowrap">
                <thead>
                    <tr className="border-b border-separator text-muted">
                        <th className="px-3 py-2 text-left font-normal">
                            {t("refining.enchantment")}
                        </th>
                        {tiers.map((tier) => (
                            <th key={tier} className="px-3 py-2 text-right font-medium">
                                T{tier}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {levels.map((level) => (
                        <tr
                            key={level}
                            className="border-b border-separator last:border-0"
                        >
                            <th className="px-3 py-2 text-left font-medium">.{level}</th>
                            {tiers.map((tier) => {
                                const cell = cellAt(tier, level);

                                return (
                                    <td key={tier} className="p-1">
                                        {cell && <ProfitCell cell={cell} now={now} />}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
