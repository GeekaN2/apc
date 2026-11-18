import { useTranslation } from "react-i18next";

const MINUTE = 60_000;

export const ServerActivityChart: React.FC<{ from: string; orders: number[] }> = ({
    from,
    orders,
}) => {
    const { t, i18n } = useTranslation();
    const start = new Date(from).getTime();
    const peak = Math.max(0, ...orders);
    const total = orders.reduce((sum, count) => sum + count, 0);
    const time = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        hour: "2-digit",
        minute: "2-digit",
    });
    const label = (index: number) => time.format(start + index * MINUTE);

    return (
        <div className="space-y-1">
            <div className="flex justify-between gap-2 text-xs text-muted">
                <span>{t("serversPage.orderTotal", { count: total })}</span>
                <span>{t("serversPage.orderPeak", { count: peak })}</span>
            </div>
            <div
                className="grid h-9 grid-cols-[repeat(60,minmax(0,1fr))] gap-px"
                role="img"
                aria-label={t("serversPage.chartLabel", { count: total, peak })}
            >
                {orders.map((count, index) => (
                    <div
                        key={start + index * MINUTE}
                        title={t("serversPage.minuteOrders", {
                            time: label(index),
                            count,
                        })}
                        className="flex items-end"
                    >
                        <div
                            className={`min-h-0.5 w-full rounded-t-xs ${count ? "bg-accent" : "bg-separator"}`}
                            style={{ height: peak ? `${(100 * count) / peak}%` : 0 }}
                        />
                    </div>
                ))}
            </div>
            <div
                className="flex justify-between text-xs text-muted tabular-nums"
                aria-hidden
            >
                <time dateTime={from}>{label(0)}</time>
                <time
                    dateTime={new Date(
                        start + (orders.length - 1) * MINUTE,
                    ).toISOString()}
                >
                    {label(orders.length - 1)}
                </time>
            </div>
        </div>
    );
};
