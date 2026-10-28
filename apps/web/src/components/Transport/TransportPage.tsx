import { type Route, compareTransports, findRoutes } from "@apc/calc";
import { Alert, Input, Label, ListBox, Select, Spinner } from "@heroui/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMarkets } from "../../api/market";
import {
    CITIES,
    CRAFTING_CITIES,
    type City,
    type Names,
    itemIconUrl,
    useNames,
    useTradeCatalog,
} from "../../catalog/catalog";
import { ANY, type TransportSettings, useTransportStore } from "../../store/transport";
import {
    formatAge,
    formatNumber,
    formatPercent,
    formatSilver,
    isStale,
} from "../ProfitTable/format";
import { NumberInput, Toggle } from "../SettingsControls/SettingsControls";

const SORTS = ["profitVolume", "profit", "profitPercentage", "profitPerWeight"] as const;

/** Marketplace categories worth carrying, in the order of the market */
const CATEGORIES = [
    "weapons",
    "armors",
    "head",
    "shoes",
    "offhands",
    "capes",
    "bags",
    "mounts",
    "consumables",
    "gathering",
    "crafting",
    "artefacts",
    "farming",
    "furniture",
    "other",
] as const;

function Choice<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: readonly { id: T; label: string }[];
    onChange: (value: T) => void;
}) {
    return (
        <Select
            value={value}
            onChange={(key) => key !== null && onChange(key as T)}
            fullWidth
        >
            <Label>{label}</Label>
            <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item
                            key={option.id}
                            id={option.id}
                            textValue={option.label}
                        >
                            {option.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

const SettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const settings = useTransportStore();
    const { update } = settings;
    const cityOptions = <C extends City>(cities: readonly C[]) => [
        { id: ANY as C | typeof ANY, label: t("transport.any") },
        ...cities.map((city) => ({
            id: city as C | typeof ANY,
            label: t(`cities.${city as City}`),
        })),
    ];

    return (
        <section className="flex flex-col gap-4" aria-label={t("profit.settings")}>
            <Choice
                label={t("transport.from")}
                value={settings.from}
                options={cityOptions(CRAFTING_CITIES)}
                onChange={(from) => update({ from })}
            />
            <Choice
                label={t("transport.to")}
                value={settings.to}
                options={cityOptions(CITIES)}
                onChange={(to) => update({ to })}
            />
            <Choice
                label={t("transport.sort")}
                value={settings.sort}
                options={SORTS.map((id) => ({ id, label: t(`transport.sorts.${id}`) }))}
                onChange={(sort) => update({ sort })}
            />
            <Toggle
                label={t("transport.freshOnly")}
                isSelected={settings.freshOnly}
                onChange={(freshOnly) => update({ freshOnly })}
            />
            <Toggle
                label={t("profit.premium")}
                isSelected={settings.premium}
                onChange={(premium) => update({ premium })}
            />
            <NumberInput
                label={t("transport.minSoldPerDay")}
                value={settings.minSoldPerDay}
                onChange={(minSoldPerDay) => update({ minSoldPerDay })}
            />
        </section>
    );
};

const Price: React.FC<{ city: string; price: number; date: Date; now: number }> = ({
    city,
    price,
    date,
    now,
}) => {
    const { t, i18n } = useTranslation();

    return (
        <span className="whitespace-nowrap">
            {t(`cities.${city as City}`)} {formatSilver(price, i18n.language)} ·{" "}
            <span className={isStale(date, now) ? "text-danger" : undefined}>
                {formatAge(date, now, i18n.language)}
            </span>
        </span>
    );
};

const RouteRow: React.FC<{ route: Route; names?: Names; now: number }> = ({
    route,
    names,
    now,
}) => {
    const { t, i18n } = useTranslation();
    const { result } = route;
    const name =
        names?.items[route.marketId] ??
        names?.items[route.item.uniqueName] ??
        route.marketId;
    const level = route.marketId.split("@")[1] ?? "0";

    return (
        <div className="flex h-full items-center gap-3 border-b border-separator px-2 text-sm">
            <img
                src={itemIconUrl(route.marketId, 48, route.quality)}
                alt=""
                loading="lazy"
                className="size-11 shrink-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate" title={name}>
                    {name}{" "}
                    <span className="text-muted">
                        T{route.item.tier}.{level}
                        {route.quality > 1 &&
                            ` · ${t(`profit.qualityNames.${route.quality}` as "profit.qualityNames.1")}`}
                    </span>
                </span>
                <span className="truncate text-xs text-muted tabular-nums">
                    <Price
                        city={route.from.city}
                        price={route.from.price}
                        date={route.from.date}
                        now={now}
                    />{" "}
                    →{" "}
                    <Price
                        city={route.to.city}
                        price={route.to.sale.price}
                        date={route.to.sale.date}
                        now={now}
                    />
                </span>
            </div>
            <div className="flex shrink-0 flex-col items-end tabular-nums">
                <span className="font-medium text-success">
                    {formatSilver(result.profit!, i18n.language)}
                </span>
                <span className="text-xs text-success">
                    {formatPercent(result.profitPercentage!, i18n.language)}%
                </span>
            </div>
            <div className="hidden w-24 shrink-0 flex-col items-end text-xs text-muted tabular-nums sm:flex">
                {route.averageItems !== undefined && (
                    <span>
                        {t("transport.perDay", {
                            value: formatNumber(route.averageItems, i18n.language, 1),
                        })}
                    </span>
                )}
                {result.profitPerWeight !== undefined && (
                    <span>
                        {t("transport.perKg", {
                            value: formatSilver(result.profitPerWeight, i18n.language),
                        })}
                    </span>
                )}
            </div>
        </div>
    );
};

const ROW_HEIGHT = 60;

/** Only the visible rows are rendered: there can be thousands of routes */
const RouteList: React.FC<{ routes: Route[]; names?: Names; now: number }> = ({
    routes,
    names,
    now,
}) => {
    const virtualizer = useWindowVirtualizer({
        count: routes.length,
        estimateSize: () => ROW_HEIGHT,
        overscan: 8,
    });

    return (
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => (
                <div
                    key={row.key}
                    className="absolute inset-x-0"
                    style={{
                        height: ROW_HEIGHT,
                        transform: `translateY(${row.start}px)`,
                    }}
                >
                    <RouteRow route={routes[row.index]!} names={names} now={now} />
                </div>
            ))}
        </div>
    );
};

function citiesOf(
    side: TransportSettings["from"] | TransportSettings["to"],
    all: readonly City[],
) {
    return side === ANY ? all : [side];
}

export const TransportPage: React.FC = () => {
    const { t } = useTranslation();
    const settings = useTransportStore();
    const catalog = useTradeCatalog();
    const names = useNames();
    const [search, setSearch] = useState("");
    const query = useDeferredValue(search.trim().toLowerCase());
    const fromCities = citiesOf(settings.from, CRAFTING_CITIES);
    const toCities = citiesOf(settings.to, CITIES);
    const { markets, isPending, isFetching, error } = useMarkets([
        ...new Set([...fromCities, ...toCities]),
    ]);
    const now = Math.max(0, ...markets.map((market) => market.generatedAt));

    const routes = useMemo(() => {
        if (!catalog.data) {
            return [];
        }

        return findRoutes({
            catalog: catalog.data,
            from: markets.filter((m) =>
                (fromCities as readonly string[]).includes(m.city),
            ),
            to: markets.filter((m) => (toCities as readonly string[]).includes(m.city)),
            now,
            premium: settings.premium,
        });
        // fromCities and toCities follow settings.from and settings.to
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalog.data, markets, now, settings.premium, settings.from, settings.to]);

    const shown = useMemo(
        () =>
            routes
                .filter(
                    (route) =>
                        route.result.profit! > 0 &&
                        (!settings.freshOnly || route.result.freshPrices === 2) &&
                        (settings.category === ANY ||
                            route.item.shopCategory === settings.category) &&
                        (route.averageItems ?? 0) >= settings.minSoldPerDay &&
                        (!query ||
                            (
                                names.data?.items[route.marketId] ??
                                names.data?.items[route.item.uniqueName] ??
                                route.marketId
                            )
                                .toLowerCase()
                                .includes(query)),
                )
                .sort((a, b) =>
                    compareTransports([settings.sort, "profit"])(a.result, b.result),
                ),
        [routes, settings, query, names.data],
    );

    return (
        <div className="flex flex-col gap-5">
            <h1 className="text-2xl font-semibold">🐗 {t("sections.transportations")}</h1>
            <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
                <SettingsPanel />
                <div className="flex min-w-0 flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <Input
                            aria-label={t("transport.search")}
                            placeholder={t("transport.search")}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="w-full sm:w-64"
                        />
                        <div className="w-full sm:w-56">
                            <Choice
                                label={t("tree.category")}
                                value={settings.category}
                                options={[
                                    { id: ANY, label: t("transport.allCategories") },
                                    ...CATEGORIES.map((id) => ({
                                        id,
                                        label: names.data?.categories[id] ?? id,
                                    })),
                                ]}
                                onChange={(category) => settings.update({ category })}
                            />
                        </div>
                    </div>
                    <div className="flex min-h-6 items-center gap-2 text-sm text-muted">
                        {isPending || catalog.isPending ? (
                            <>
                                <Spinner size="sm" /> {t("transport.loading")}
                            </>
                        ) : (
                            <>
                                {t("transport.count", { count: shown.length })}
                                {isFetching && <Spinner size="sm" />}
                            </>
                        )}
                    </div>
                    {error && (
                        <Alert status="danger">
                            <Alert.Content>
                                <Alert.Title>{t("profit.pricesError")}</Alert.Title>
                                <Alert.Description>{error.message}</Alert.Description>
                            </Alert.Content>
                        </Alert>
                    )}
                    {!isPending && shown.length === 0 && (
                        <p className="text-muted">{t("transport.empty")}</p>
                    )}
                    {shown.length > 0 && (
                        <div className="rounded-xl border border-separator">
                            <RouteList routes={shown} names={names.data} now={now} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
