import { type PickedPrice, hasPrice, pickSalePrice } from "@apc/calc";
import type { GameConstants } from "@apc/game-data";
import { type QuoteMap, mergedQuote, quoteKey } from "./quotes";
import type { City } from "../catalog/cities";

/** A price used in a calculation and how old it is */
export interface UsedPrice {
    price: number;
    date: Date;
    /** Typed in by the user instead of the market price */
    manual?: boolean;
}

export type SalePrice = PickedPrice & { manual?: boolean };

export interface PriceBookOptions {
    quotes: QuoteMap | undefined;
    /** Own price per unit by market id */
    manual: (marketId: string) => number | undefined;
    marketPlace: GameConstants["marketPlace"];
    premium: boolean;
    /** When the quotes were loaded */
    now: number;
}

/** Market prices with the user's own prices on top */
export function createPriceBook({
    quotes,
    manual,
    marketPlace,
    premium,
    now,
}: PriceBookOptions) {
    /** Lowest sell order: things are bought instantly */
    function marketBuy(marketId: string, city: City): UsedPrice | undefined {
        const quote = quotes?.get(quoteKey(marketId, city));

        return quote && hasPrice(quote.sellPriceMin)
            ? { price: quote.sellPriceMin, date: new Date(quote.sellPriceMinDate ?? 0) }
            : undefined;
    }

    /** The fresh or more profitable side of the market over the qualities */
    function marketSell(
        marketId: string,
        city: City,
        qualities: readonly number[] = [1],
    ): SalePrice | undefined {
        const quote = mergedQuote(quotes, marketId, city, qualities, now);
        const picked = quote && pickSalePrice(quote, { marketPlace, now, premium });

        return picked && hasPrice(picked.price) ? picked : undefined;
    }

    function own(marketId: string): UsedPrice | undefined {
        const price = manual(marketId);

        return hasPrice(price) ? { price, date: new Date(now), manual: true } : undefined;
    }

    return {
        marketBuy,
        marketSell,
        buy: (marketId: string, city: City) => own(marketId) ?? marketBuy(marketId, city),
        /** An own price is a sell order the user places */
        sell: (
            marketId: string,
            city: City,
            qualities?: readonly number[],
        ): SalePrice | undefined => {
            const price = own(marketId);

            return price
                ? { ...price, kind: "sellOrder" }
                : marketSell(marketId, city, qualities);
        },
    };
}

export type PriceBook = ReturnType<typeof createPriceBook>;

/** A row of the own prices editor */
export interface PriceRow {
    marketId: string;
    /** Market price the own price replaces */
    market?: UsedPrice;
}

export interface PriceGroup {
    /** Key of the group title in `prices.groups` */
    key: "products" | "raw" | "materials" | "resources" | "components" | "journals";
    rows: PriceRow[];
}
