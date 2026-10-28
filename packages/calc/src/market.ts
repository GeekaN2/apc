import type { GameConstants } from "@apc/game-data";

/** Premium halves the transaction tax; not in ao-bin-dumps */
export const PREMIUM_TAX_FACTOR = 0.5;

/**
 * How an item is sold: by placing a sell order (tax + setup fee)
 * or instantly to the best buy order (tax only)
 */
export type SaleKind = "sellOrder" | "buyOrder";

export interface Sale {
    /** Price per unit; missing or zero means there is no market data */
    price?: number;
    kind: SaleKind;
}

export function marketFee(
    marketPlace: GameConstants["marketPlace"],
    kind: SaleKind,
    premium = true,
): number {
    const tax = marketPlace.transactionTax * (premium ? PREMIUM_TAX_FACTOR : 1);

    return kind === "sellOrder" ? tax + marketPlace.setupFee : tax;
}

/** Silver received per unit after the market fees */
export function saleIncome(
    marketPlace: GameConstants["marketPlace"],
    price: number,
    kind: SaleKind,
    premium = true,
): number {
    return price * (1 - marketFee(marketPlace, kind, premium));
}

export function hasPrice(price: number | undefined): price is number {
    return price !== undefined && price > 0;
}
