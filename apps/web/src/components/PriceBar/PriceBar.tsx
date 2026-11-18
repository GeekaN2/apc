import { ArrowRotateLeft } from "@gravity-ui/icons";
import { Input, Popover } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentServer } from "../../api/servers";
import type { Names } from "../../catalog/catalog";
import {
    type RecipeIngredient,
    formatRecipeAmount,
    marketVariant,
    summarizeRecipeAmounts,
} from "../../catalog/recipeAmounts";
import type { PriceGroup, PriceRow } from "../../prices/priceBook";
import { useManualPrices, useManualPricesStore } from "../../store/manualPrices";
import { RecipeIcon } from "../RecipeIcon/RecipeIcon";

interface Variant extends PriceRow {
    tier?: number;
    enchantmentLevel: number;
}

/** One ingredient or product over its tiers and enchantment levels */
interface Kind {
    key: string;
    variants: Variant[];
}

function kindsOf(groups: readonly PriceGroup[]): Kind[] {
    const kinds = new Map<string, Kind>();

    for (const row of groups.flatMap((group) => group.rows)) {
        const { key, ...variant } = marketVariant(row.marketId);
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
            <div className="flex items-center gap-1.5">
                <Popover.Heading className="text-sm font-medium">{name}</Popover.Heading>
                {hasOwn && (
                    <button
                        type="button"
                        aria-label={t("prices.reset")}
                        title={t("prices.reset")}
                        className="rounded-md p-1 text-muted hover:bg-default hover:text-foreground"
                        onClick={() =>
                            clear(
                                serverId,
                                kind.variants.map((v) => v.marketId),
                            )
                        }
                    >
                        <ArrowRotateLeft className="size-3.5" />
                    </button>
                )}
            </div>
            {/* Only the fields scroll on narrow screens, the heading stays */}
            <div className="overflow-x-auto">
                <table className="border-separate border-spacing-1 text-xs text-muted">
                    {tiers.length > 1 && (
                        <thead>
                            <tr>
                                {levels.length > 1 && <th />}
                                {tiers.map((tier) => (
                                    <th
                                        key={tier}
                                        className="pe-2.5 text-right font-medium"
                                    >
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
                                            v.tier === tier &&
                                            v.enchantmentLevel === level,
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
        </div>
    );
};

/**
 * The product and ingredients as icons; one opens own prices for its tiers and
 * enchantment levels. A dot marks icons with own prices.
 */
export const PriceBar: React.FC<{
    groups: readonly PriceGroup[];
    names?: Names;
    recipes: readonly (readonly RecipeIngredient[])[];
}> = ({ groups, names, recipes }) => {
    const { t, i18n } = useTranslation();
    const serverId = useCurrentServer()?.id;
    const manual = useManualPrices();

    if (!serverId) {
        return null;
    }

    const amounts = summarizeRecipeAmounts(recipes);

    return (
        <div className="flex flex-wrap items-start gap-1" aria-label={t("prices.title")}>
            {kindsOf(groups).map((kind) => {
                const name = kindName(names, kind);
                const amount = amounts.get(kind.key);
                const count = amount && formatRecipeAmount(amount, i18n.language);
                const title = count ? `${name} ×${count}` : name;
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
                                aria-label={`${t("prices.title")}: ${title}`}
                                title={title}
                                className="relative flex flex-col items-center rounded-lg p-0.5 hover:bg-default"
                            >
                                <RecipeIcon
                                    marketId={icon.marketId}
                                    name=""
                                    size={40}
                                    amount={count}
                                />
                                {hasOwn && (
                                    <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-accent" />
                                )}
                            </button>
                        </Popover.Trigger>
                        <Popover.Content placement="bottom start">
                            <Popover.Dialog className="max-w-[calc(100vw-2rem)]">
                                <KindPrices kind={kind} name={name} serverId={serverId} />
                            </Popover.Dialog>
                        </Popover.Content>
                    </Popover>
                );
            })}
        </div>
    );
};
