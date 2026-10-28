import { Button, Disclosure, Input } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentServer } from "../../api/servers";
import { type Names, itemIconUrl } from "../../catalog/catalog";
import type { PriceGroup, PriceRow } from "../../prices/priceBook";
import { useManualPrices, useManualPricesStore } from "../../store/manualPrices";
import { formatAge, formatSilver, isStale } from "../ProfitTable/format";

/** Names have `@N` keys only for enchanted resources */
function nameOf(names: Names | undefined, marketId: string): string {
    const [base, level] = marketId.split("@");
    const name = names?.items[marketId] ?? names?.items[base!] ?? base!;

    return level && !names?.items[marketId] ? `${name} .${level}` : name;
}

const PriceInput: React.FC<{
    row: PriceRow;
    label: string;
    value: number | undefined;
    onChange: (price: number | undefined) => void;
}> = ({ row, label, value, onChange }) => {
    // A draft keeps what is being typed, e.g. an empty field before a new number
    const [draft, setDraft] = useState<string>();

    return (
        <Input
            aria-label={label}
            inputMode="numeric"
            placeholder={row.market ? String(row.market.price) : "—"}
            value={draft ?? (value === undefined ? "" : String(value))}
            onChange={(event) => {
                const text = event.target.value.replace(/[^\d]/g, "");
                const price = Number(text);

                setDraft(text);
                onChange(text && price > 0 ? price : undefined);
            }}
            onBlur={() => setDraft(undefined)}
            className="w-28 text-right tabular-nums"
        />
    );
};

/** Own prices instead of the market ones for everything the calculation uses */
export const PriceEditor: React.FC<{
    groups: readonly PriceGroup[];
    names?: Names;
    now: number;
}> = ({ groups, names, now }) => {
    const { t, i18n } = useTranslation();
    const serverId = useCurrentServer()?.id;
    const manual = useManualPrices();
    const setPrice = useManualPricesStore((state) => state.setPrice);
    const clear = useManualPricesStore((state) => state.clear);
    const ids = groups.flatMap((group) => group.rows.map((row) => row.marketId));
    const ownCount = ids.filter((id) => manual(id) !== undefined).length;

    if (!serverId || ids.length === 0) {
        return null;
    }

    return (
        <Disclosure className="rounded-xl border border-separator">
            <Disclosure.Heading>
                <Disclosure.Trigger className="flex w-full items-center justify-between px-4 py-3">
                    <span className="font-medium">
                        {t("prices.title")}
                        {ownCount > 0 && (
                            <span className="ms-2 text-sm text-accent">
                                {t("prices.ownCount", { count: ownCount })}
                            </span>
                        )}
                    </span>
                    <Disclosure.Indicator />
                </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content>
                <Disclosure.Body className="flex flex-col gap-5 px-4 pb-4">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted">{t("prices.hint")}</p>
                        <Button
                            size="sm"
                            variant="tertiary"
                            isDisabled={ownCount === 0}
                            onPress={() => clear(serverId, ids)}
                        >
                            {t("prices.reset")}
                        </Button>
                    </div>
                    {groups
                        .filter((group) => group.rows.length > 0)
                        .map((group) => (
                            <section key={group.key} className="flex flex-col gap-2">
                                <h3 className="text-sm font-medium text-muted">
                                    {t(`prices.groups.${group.key}`)}
                                </h3>
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-x-6 gap-y-1">
                                    {group.rows.map((row) => {
                                        const name = nameOf(names, row.marketId);

                                        return (
                                            <div
                                                key={row.marketId}
                                                className="flex items-center gap-2"
                                            >
                                                <img
                                                    src={itemIconUrl(row.marketId, 32)}
                                                    alt=""
                                                    loading="lazy"
                                                    className="size-8 shrink-0"
                                                />
                                                <div className="flex min-w-0 flex-1 flex-col">
                                                    <span
                                                        className="truncate text-sm"
                                                        title={name}
                                                    >
                                                        {name}
                                                    </span>
                                                    <span className="text-xs whitespace-nowrap text-muted tabular-nums">
                                                        {row.market ? (
                                                            <>
                                                                {formatSilver(
                                                                    row.market.price,
                                                                    i18n.language,
                                                                )}{" "}
                                                                ·{" "}
                                                                <span
                                                                    className={
                                                                        isStale(
                                                                            row.market
                                                                                .date,
                                                                            now,
                                                                        )
                                                                            ? "text-danger"
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {formatAge(
                                                                        row.market.date,
                                                                        now,
                                                                        i18n.language,
                                                                    )}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            t("profit.noPrices")
                                                        )}
                                                    </span>
                                                </div>
                                                <PriceInput
                                                    row={row}
                                                    label={name}
                                                    value={manual(row.marketId)}
                                                    onChange={(price) =>
                                                        setPrice(
                                                            serverId,
                                                            row.marketId,
                                                            price,
                                                        )
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                </Disclosure.Body>
            </Disclosure.Content>
        </Disclosure>
    );
};
