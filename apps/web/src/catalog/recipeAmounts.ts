export interface RecipeIngredient {
    marketId: string;
    count: number;
}

interface RecipeAmount {
    marketId: string;
    min: number;
    max: number;
}

/** The tier-independent kind of an item, including the suffix used by royal tokens. */
export function marketVariant(marketId: string) {
    const [id = "", level] = marketId.split("@");
    const prefix = /^T(\d)_/.exec(id);
    const suffix = /_T(\d)$/.exec(id);

    return {
        key: id
            .replace(/^T\d_/, "")
            .replace(/_LEVEL\d$/, "")
            .replace(/_T\d$/, ""),
        tier: Number(prefix?.[1] ?? suffix?.[1]) || undefined,
        enchantmentLevel: Number(level ?? 0),
    };
}

/** Sum repeated ingredients in one recipe, then range over recipes that use each kind. */
export function summarizeRecipeAmounts(
    recipes: readonly (readonly RecipeIngredient[])[],
) {
    const amounts = new Map<string, RecipeAmount>();

    for (const recipe of recipes) {
        const totals = new Map<string, RecipeIngredient>();

        for (const { marketId, count } of recipe) {
            const { key } = marketVariant(marketId);
            const current = totals.get(key);

            totals.set(key, {
                marketId: current?.marketId ?? marketId,
                count: (current?.count ?? 0) + count,
            });
        }

        for (const [key, { marketId, count }] of totals) {
            const amount = amounts.get(key);

            amounts.set(key, {
                marketId: amount?.marketId ?? marketId,
                min: Math.min(amount?.min ?? count, count),
                max: Math.max(amount?.max ?? count, count),
            });
        }
    }

    return amounts;
}

export function formatRecipeAmount(
    amount: number | Pick<RecipeAmount, "min" | "max">,
    language: string,
): string {
    const format = new Intl.NumberFormat(language, { maximumFractionDigits: 2 });

    if (typeof amount === "number") {
        return `×${format.format(amount)}`;
    }

    const min = format.format(amount.min);
    const max = format.format(amount.max);

    return min === max ? `×${min}` : `×${min}–${max}`;
}
