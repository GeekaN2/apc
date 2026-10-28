import { bestPrices, seedServers, upsertOrders } from "@apc/db";
import { createTestDb } from "@apc/db/testing";
import { describe, expect, it } from "vitest";
import { ORDER_MAX_LIFETIME_MS, parseBulk, parseExpires } from "../src/orders.ts";

const NOW = new Date("2026-10-28T12:00:00Z");

/** A real order from the Europe server */
const ORDER = {
    Amount: 2,
    AuctionType: "offer",
    EnchantmentLevel: 1,
    Expires: "2026-11-01T06:45:26.31748",
    Id: 3602731867,
    ItemGroupTypeId: "T4_HEAD_CLOTH_KEEPER",
    ItemTypeId: "T4_HEAD_CLOTH_KEEPER@1",
    LocationId: 4002,
    QualityLevel: 2,
    UnitPriceSilver: 6755,
};

describe("parseExpires", () => {
    it("reads dates without a zone as UTC", () => {
        expect(parseExpires("2026-11-01T06:45:26.31748").toISOString()).toBe(
            "2026-11-01T06:45:26.317Z",
        );
        expect(parseExpires("2026-11-01T06:45:26+03:00").toISOString()).toBe(
            "2026-11-01T03:45:26.000Z",
        );
    });
});

describe("parseBulk", () => {
    it("turns NATS orders into market orders", () => {
        expect(parseBulk("europe", [ORDER], NOW)).toEqual({
            orders: [
                {
                    serverId: "europe",
                    orderId: 3602731867,
                    itemId: "T4_HEAD_CLOTH_KEEPER@1",
                    locationId: "4002",
                    qualityLevel: 2,
                    unitPriceSilver: 6755,
                    amount: 2,
                    auctionType: "offer",
                    expiresAt: new Date("2026-11-01T06:45:26.317Z"),
                    updatedAt: NOW,
                },
            ],
            invalid: 0,
        });
    });

    it("pads location ids and caps the order lifetime", () => {
        const { orders } = parseBulk(
            "europe",
            [{ ...ORDER, LocationId: 7, Expires: "2026-12-28T12:00:00" }],
            NOW,
        );

        expect(orders[0]?.locationId).toBe("0007");
        expect(orders[0]?.expiresAt.getTime()).toBe(
            NOW.getTime() + ORDER_MAX_LIFETIME_MS,
        );
    });

    it("skips invalid orders and keeps the last copy of a repeated one", () => {
        const { orders, invalid } = parseBulk(
            "europe",
            [
                ORDER,
                { ...ORDER, UnitPriceSilver: 6000 },
                { ...ORDER, Id: "not a number" },
                { ...ORDER, Id: 2, Expires: "someday" },
                null,
            ],
            NOW,
        );

        expect(orders.map((o) => o.unitPriceSilver)).toEqual([6000]);
        expect(invalid).toBe(3);
    });

    it("stores a parsed bulk with repeated orders in one upsert", async () => {
        const { db, close } = await createTestDb();

        await seedServers(db);
        await upsertOrders(
            db,
            parseBulk("europe", [ORDER, { ...ORDER, UnitPriceSilver: 6500 }], NOW).orders,
        );

        const quotes = await bestPrices(db, {
            serverId: "europe",
            itemIds: ["T4_HEAD_CLOTH_KEEPER@1"],
            cities: ["Fort Sterling"],
            qualities: [2],
            now: NOW,
        });

        expect(quotes[0]).toMatchObject({ sellPriceMin: 6500, sellPriceMinDate: NOW });
        await close();
    });
});
