import type { CraftResult } from "@apc/calc";
import { Tooltip } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { itemIconUrl } from "../../catalog/catalog";
import type { SalePrice, UsedPrice } from "../../prices/priceBook";
import { formatAge, formatNumber, formatPercent, formatSilver, isStale } from "./format";

/** One tier and enchantment level of a crafted item */
export interface ProfitTableCell {
    marketId: string;
    tier: number;
    enchantmentLevel: number;
    returnRate: number;
    /** Focus per craft without focus efficiency */
    focus?: number;
    result: CraftResult;
    sale?: SalePrice;
    /** Buy prices of the recipe resources by market id */
    buyPrices: ReadonlyMap<string, UsedPrice>;
    journal?: { empty?: UsedPrice; full?: SalePrice };
    /** Average items sold per day in the selling city */
    soldPerDay?: number;
}

export const PriceAge: React.FC<{ date: Date; now: number }> = ({ date, now }) => {
    const { t, i18n } = useTranslation();
    const stale = isStale(date, now);

    return (
        <span
            className={stale ? "text-danger" : "text-muted"}
            title={stale ? t("profit.stale") : undefined}
        >
            {formatAge(date, now, i18n.language)}
        </span>
    );
};

export const Line: React.FC<{
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
const Breakdown: React.FC<{ cell: ProfitTableCell; name?: string; now: number }> = ({
    cell,
    name,
    now,
}) => {
    const { t, i18n } = useTranslation();
    const silver = (value: number) => formatSilver(value, i18n.language);
    const { result, sale } = cell;
    const rate = formatPercent(cell.returnRate * 100, i18n.language).replace("+", "");
    const priceOf = (price: UsedPrice | undefined) =>
        price && price.price > 0 ? (
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

    return (
        <div className="flex flex-col gap-1.5 text-sm">
            {name && (
                <div className="font-medium whitespace-nowrap">
                    {name} {cell.tier}.{cell.enchantmentLevel}
                </div>
            )}
            <Line
                icon={cell.marketId}
                label={`${t("profit.sale")} (${
                    sale?.kind === "buyOrder"
                        ? t("profit.saleBuyOrder")
                        : t("profit.saleSellOrder")
                }) × ${result.amountCrafted}`}
                value={priceOf(sale)}
            />
            {result.income !== undefined && (
                <Line label={t("profit.income")} value={silver(result.income)} />
            )}
            {cell.soldPerDay !== undefined && (
                <Line
                    label={t("profit.soldPerDay")}
                    value={formatSilver(cell.soldPerDay, i18n.language)}
                />
            )}
            {result.resources.map((line) => (
                <Line
                    key={line.marketId}
                    icon={line.marketId}
                    label={`× ${line.count}${
                        line.returned ? `, ${t("profit.returned", { rate })}` : ""
                    }`}
                    value={
                        <>
                            {priceOf(cell.buyPrices.get(line.marketId))}
                            {line.cost !== undefined && <> → {silver(line.cost)}</>}
                        </>
                    }
                />
            ))}
            {result.journal && (
                <Line
                    icon={result.journal.marketId}
                    label={t("profit.journalFilled", {
                        filled: formatNumber(result.journal.filled, i18n.language, 2),
                    })}
                    value={
                        result.journal.profit === undefined ? (
                            <span className="text-danger">{t("profit.noPrices")}</span>
                        ) : (
                            <>
                                {priceOf(cell.journal?.empty)} /{" "}
                                {priceOf(cell.journal?.full)} → +
                                {silver(result.journal.profit)}
                            </>
                        )
                    }
                />
            )}
            <Line label={t("profit.stationFee")} value={silver(result.stationFee)} />
            {result.silver > 0 && (
                <Line label={t("profit.recipeSilver")} value={silver(result.silver)} />
            )}
            {cell.focus !== undefined && (
                <Line label={t("profit.focusCost")} value={silver(cell.focus)} />
            )}
            {result.cost !== undefined && (
                <Line label={t("profit.cost")} value={silver(result.cost)} />
            )}
            {result.profit !== undefined && (
                <Line
                    label={<strong>{t("profit.profit")}</strong>}
                    value={<strong>{silver(result.profit)}</strong>}
                />
            )}
        </div>
    );
};

/** Cells by tier (columns) and enchantment level (rows) */
export function TierGrid<C extends { tier: number; enchantmentLevel: number }>({
    cells,
    renderCell,
}: {
    cells: readonly C[];
    renderCell: (cell: C) => React.ReactNode;
}) {
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
                            {t("profit.enchantment")}
                        </th>
                        {/* Cells are p-1 around a px-3 button: 16px on the right as here */}
                        {tiers.map((tier) => (
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
                                        {cell && renderCell(cell)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** A profit and its percentage, coloured by sign, with details on hover */
export const ProfitButton: React.FC<{
    profit?: number;
    percentage?: number;
    details: React.ReactNode;
}> = ({ profit, percentage, details }) => {
    const { t, i18n } = useTranslation();
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
                            <span aria-label={t("profit.noPrices")}>—</span>
                        ) : (
                            formatSilver(profit, i18n.language)
                        )}
                    </span>
                    {percentage !== undefined && (
                        <span className={`text-xs ${color}`}>
                            {formatPercent(percentage, i18n.language)}%
                        </span>
                    )}
                </button>
            </Tooltip.Trigger>
            <Tooltip.Content placement="bottom" className="max-w-none break-normal">
                {details}
            </Tooltip.Content>
        </Tooltip>
    );
};

/** Profit by tier (columns) and enchantment level (rows) */
export const ProfitTable: React.FC<{
    cells: readonly ProfitTableCell[];
    now: number;
    /** Item name for the cell details */
    name?: string;
}> = ({ cells, now, name }) => (
    <TierGrid
        cells={cells}
        renderCell={(cell) => (
            <ProfitButton
                profit={cell.result.profit}
                percentage={cell.result.profitPercentage}
                details={<Breakdown cell={cell} name={name} now={now} />}
            />
        )}
    />
);
