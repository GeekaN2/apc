import { Input, Popover } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentServer } from "../../api/servers";
import { type Names, itemIconUrl } from "../../catalog/catalog";
import type { PriceGroup, PriceRow } from "../../prices/priceBook";
import { useManualPrices, useManualPricesStore } from "../../store/manualPrices";

interface Variant extends PriceRow {
    tier?: number;
    enchantmentLevel: number;
}

/** One ingredient or product over its tiers and enchantment levels */
interface Kind {
    key: string;
    variants: Variant[];
}

/**
 * `T5_METALBAR_LEVEL2@2` → METALBAR, tier 5, level 2;
 * `QUESTITEM_TOKEN_ROYAL_T6` → QUESTITEM_TOKEN_ROYAL, tier 6
 */
function parse(row: PriceRow): { key: string } & Omit<Variant, keyof PriceRow> {
    const [id, level] = row.marketId.split("@");
    const prefix = /^T(\d)_/.exec(id!);
    const suffix = /_T(\d)$/.exec(id!);
    const key = id!
        .replace(/^T\d_/, "")
        .replace(/_LEVEL\d$/, "")
        .replace(/_T\d$/, "");

    return {
        key,
        tier: Number(prefix?.[1] ?? suffix?.[1]) || undefined,
        enchantmentLevel: Number(level ?? 0),
    };
}

function kindsOf(groups: readonly PriceGroup[]): Kind[] {
    const kinds = new Map<string, Kind>();

    for (const row of groups.flatMap((group) => group.rows)) {
        const { key, ...variant } = parse(row);
        const kind = kinds.get(key) ?? { key, variants: [] };

        kind.variants.push({ ...row, ...variant });
        kinds.set(key, kind);
    }

    return [...kinds.values()];
}

/** Name without the tier, e.g. "Steel Bar" out of "Uncommon Steel Bar" stays as is */
function kindName(names: Names | undefined, kind: Kind): string {
    const id = kind.variants[0]!.marketId;
    const name = names?.items[id] ?? names?.items[id.split("@")[0]!] ?? kind.key;

    return name.replace(/\s*\([^)]*\)$/, "");
}

const PriceInput: React.FC<{
    variant: Variant;
    label: string;
    value: number | undefined;
    onChange: (price: number | undefined) => void;
}> = ({ variant, label, value, onChange }) => {
    // A draft keeps what is being typed, e.g. an empty field before a new number
    const [draft, setDraft] = useState<string>();

    return (
        <Input
            aria-label={label}
            inputMode="numeric"
            placeholder={variant.market ? String(variant.market.price) : "—"}
            value={draft ?? (value === undefined ? "" : String(value))}
            onChange={(event) => {
                const text = event.target.value.replace(/\D/g, "");

                setDraft(text);
                onChange(Number(text) > 0 ? Number(text) : undefined);
            }}
            onBlur={() => setDraft(undefined)}
            className={`w-20 px-2 text-right text-sm tabular-nums ${
                value === undefined ? "" : "text-accent"
            }`}
        />
    );
};

/** Own prices of a kind in the layout of the profit table */
const KindPrices: React.FC<{ kind: Kind; name: string; serverId: string }> = ({
    kind,
    name,
    serverId,
}) => {
    const { t } = useTranslation();
    const manual = useManualPrices();
    const setPrice = useManualPricesStore((state) => state.setPrice);
    const clear = useManualPricesStore((state) => state.clear);
    const tiers = [...new Set(kind.variants.map((v) => v.tier))].sort(
        (a, b) => (a ?? 0) - (b ?? 0),
    );
    const levels = [...new Set(kind.variants.map((v) => v.enchantmentLevel))].sort(
        (a, b) => a - b,
    );
    const hasOwn = kind.variants.some((v) => manual(v.marketId) !== undefined);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
                <Popover.Heading className="text-sm font-medium">{name}</Popover.Heading>
                {hasOwn && (
                    <button
                        type="button"
                        className="text-xs text-muted hover:text-foreground"
                        onClick={() =>
                            clear(
                                serverId,
                                kind.variants.map((v) => v.marketId),
                            )
                        }
                    >
                        {t("prices.reset")}
                    </button>
                )}
            </div>
            <table className="border-separate border-spacing-1 text-xs text-muted">
                {tiers.length > 1 && (
                    <thead>
                        <tr>
                            {levels.length > 1 && <th />}
                            {tiers.map((tier) => (
                                <th key={tier} className="font-medium">
                                    T{tier}
                                </th>
                            ))}
                        </tr>
                    </thead>
                )}
                <tbody>
                    {levels.map((level) => (
                        <tr key={level}>
                            {levels.length > 1 && (
                                <th className="pe-1 font-medium">.{level}</th>
                            )}
                            {tiers.map((tier) => {
                                const variant = kind.variants.find(
                                    (v) =>
                                        v.tier === tier && v.enchantmentLevel === level,
                                );

                                return (
                                    <td key={tier}>
                                        {variant && (
                                            <PriceInput
                                                variant={variant}
                                                label={`${name} ${tier ?? ""}.${level}`}
                                                value={manual(variant.marketId)}
                                                onChange={(price) =>
                                                    setPrice(
                                                        serverId,
                                                        variant.marketId,
                                                        price,
                                                    )
                                                }
                                            />
                                        )}
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

/**
 * The product and ingredients as icons; one opens own prices for its tiers and
 * enchantment levels. A dot marks icons with own prices.
 */
export const PriceBar: React.FC<{ groups: readonly PriceGroup[]; names?: Names }> = ({
    groups,
    names,
}) => {
    const { t } = useTranslation();
    const serverId = useCurrentServer()?.id;
    const manual = useManualPrices();

    if (!serverId) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1" aria-label={t("prices.title")}>
            {kindsOf(groups).map((kind) => {
                const name = kindName(names, kind);
                const icon =
                    kind.variants.find((v) => v.tier === 4 && v.enchantmentLevel === 0) ??
                    kind.variants[0]!;
                const hasOwn = kind.variants.some(
                    (v) => manual(v.marketId) !== undefined,
                );

                return (
                    <Popover key={kind.key}>
                        <Popover.Trigger>
                            <button
                                type="button"
                                aria-label={`${t("prices.title")}: ${name}`}
                                title={name}
                                className="relative rounded-lg p-0.5 hover:bg-default"
                            >
                                <img
                                    src={itemIconUrl(icon.marketId, 64)}
                                    alt=""
                                    className="size-10"
                                />
                                {hasOwn && (
                                    <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-accent" />
                                )}
                            </button>
                        </Popover.Trigger>
                        <Popover.Content placement="bottom start">
                            <Popover.Dialog className="max-w-[calc(100vw-2rem)] overflow-x-auto">
                                <KindPrices kind={kind} name={name} serverId={serverId} />
                            </Popover.Dialog>
                        </Popover.Content>
                    </Popover>
                );
            })}
        </div>
    );
};
