import type { MarketQuote } from "@apc/calc";
import { describe, expect, it } from "vitest";
import { createPriceBook } from "../src/prices/priceBook";
import { quoteKey } from "../src/prices/quotes";

const now = Date.parse("2026-10-28T12:00:00Z");
const hourAgo = new Date(now - 3_600_000).toISOString();
const quote = (sell: number, buy: number): MarketQuote => ({
    sellPriceMin: sell,
    sellPriceMinDate: sell ? hourAgo : null,
    buyPriceMax: buy,
    buyPriceMaxDate: buy ? hourAgo : null,
});
const quotes = new Map([
    [quoteKey("T4_METALBAR", "Thetford"), quote(200, 180)],
    [quoteKey("T4_MAIN_SWORD", "Caerleon", 1), quote(10_000, 0)],
    [quoteKey("T4_MAIN_SWORD", "Caerleon", 2), quote(9_000, 0)],
]);
const own: Record<string, number> = { T4_LEATHER: 150, T4_MAIN_SWORD: 12_000 };
const book = createPriceBook({
    quotes,
    manual: (id) => own[id],
    marketPlace: { setupFee: 0.025, transactionTax: 0.08 } as never,
    premium: true,
    now,
});

describe("createPriceBook", () => {
    it("buys at the lowest sell order", () => {
        expect(book.buy("T4_METALBAR", "Thetford")).toEqual({
            price: 200,
            date: new Date(hourAgo),
        });
        expect(book.buy("T4_METALBAR", "Martlock")).toBeUndefined();
    });

    it("takes an own price in any city", () => {
        expect(book.buy("T4_LEATHER", "Martlock")).toEqual({
            price: 150,
            date: new Date(now),
            manual: true,
        });
    });

    it("sells at an own price with a sell order", () => {
        expect(book.sell("T4_MAIN_SWORD", "Caerleon", [1, 2])).toMatchObject({
            price: 12_000,
            kind: "sellOrder",
            manual: true,
        });
    });

    it("keeps the market price for the editor", () => {
        expect(book.marketSell("T4_MAIN_SWORD", "Caerleon", [1, 2])?.price).toBe(9_000);
        expect(book.marketBuy("T4_LEATHER", "Thetford")).toBeUndefined();
    });
});
