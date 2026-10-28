/** Sales tax with premium; without premium it is doubled */
export const SALES_TAX = 0.04;
export const SALES_TAX_NO_PREMIUM = 0.08;

/** Fee for placing a sell order */
export const SETUP_FEE = 0.025;

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

export function marketFee(kind: SaleKind, premium = true): number {
    const tax = premium ? SALES_TAX : SALES_TAX_NO_PREMIUM;

    return kind === "sellOrder" ? tax + SETUP_FEE : tax;
}

/** Silver received per unit after the market fees */
export function saleIncome(price: number, kind: SaleKind, premium = true): number {
    return price * (1 - marketFee(kind, premium));
}

export function hasPrice(price: number | undefined): price is number {
    return price !== undefined && price > 0;
}
