import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/client.ts";
import { cityOfLocation, normalizeLocationId } from "../src/markets.ts";
import { bestPrices, deleteExpiredOrders, upsertOrders } from "../src/orders.ts";
import type { MarketOrder } from "../src/schema.ts";
import { listServers, seedServers } from "../src/servers.ts";
import { createTestDb } from "../src/testing.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const HOUR = 60 * 60 * 1000;

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
    ({ db, close } = await createTestDb());
    await seedServers(db);
});

afterEach(async () => {
    await close();
});

function order(
    overrides: Partial<MarketOrder> & Pick<MarketOrder, "orderId">,
): MarketOrder {
    return {
        serverId: "europe",
        itemId: "T4_MAIN_SWORD",
        locationId: "4002",
        qualityLevel: 1,
        unitPriceSilver: 1000,
        amount: 1,
        auctionType: "offer",
        expiresAt: new Date(NOW.getTime() + 24 * HOUR),
        updatedAt: new Date(NOW.getTime() - HOUR),
        ...overrides,
    };
}

describe("markets", () => {
    it("pads NATS location ids and maps markets and portals to cities", () => {
        expect(normalizeLocationId(7)).toBe("0007");
        expect(cityOfLocation("0007")).toBe("Thetford");
        expect(cityOfLocation("0301")).toBe("Thetford");
        expect(cityOfLocation("3003")).toBe("Black Market");
        expect(cityOfLocation("9999")).toBeUndefined();
    });
});

describe("servers", () => {
    it("seeds the public Albion Online Data servers once", async () => {
        await seedServers(db);

        expect((await listServers(db)).map((s) => s.id)).toEqual([
            "west",
            "east",
            "europe",
        ]);
    });
});

describe("orders", () => {
    it("upserts orders by server and order id", async () => {
        await upsertOrders(db, [order({ orderId: 1, unitPriceSilver: 1000 })]);
        await upsertOrders(db, [
            order({ orderId: 1, unitPriceSilver: 900, updatedAt: NOW }),
            order({ orderId: 2, unitPriceSilver: 1100 }),
        ]);

        const [quote] = await bestPrices(db, {
            serverId: "europe",
            itemIds: ["T4_MAIN_SWORD"],
            cities: ["Fort Sterling"],
            qualities: [1],
            now: NOW,
        });

        expect(quote).toEqual({
            itemId: "T4_MAIN_SWORD",
            city: "Fort Sterling",
            quality: 1,
            sellPriceMin: 900,
            sellPriceMinDate: NOW,
            buyPriceMax: 0,
            buyPriceMaxDate: null,
        });
    });

    it("takes the lowest sell and the highest buy order across a city's markets", async () => {
        await upsertOrders(db, [
            order({ orderId: 1, unitPriceSilver: 1200 }),
            order({ orderId: 2, unitPriceSilver: 1100, locationId: "4301" }),
            order({ orderId: 3, unitPriceSilver: 700, auctionType: "request" }),
            order({ orderId: 4, unitPriceSilver: 800, auctionType: "request" }),
            order({ orderId: 5, unitPriceSilver: 10, qualityLevel: 2 }),
            order({ orderId: 6, unitPriceSilver: 10, serverId: "west" }),
            order({ orderId: 7, unitPriceSilver: 10, locationId: "3005" }),
        ]);

        const quotes = await bestPrices(db, {
            serverId: "europe",
            itemIds: ["T4_MAIN_SWORD"],
            cities: ["Fort Sterling"],
            qualities: [1],
            now: NOW,
        });

        expect(quotes).toHaveLength(1);
        expect(quotes[0]).toMatchObject({ sellPriceMin: 1100, buyPriceMax: 800 });
    });

    it("ignores and deletes expired orders", async () => {
        await upsertOrders(db, [
            order({
                orderId: 1,
                unitPriceSilver: 500,
                expiresAt: new Date(NOW.getTime() - HOUR),
            }),
            order({ orderId: 2, unitPriceSilver: 1000 }),
        ]);

        const query = {
            serverId: "europe",
            itemIds: ["T4_MAIN_SWORD"],
            cities: ["Fort Sterling" as const],
            qualities: [1],
            now: NOW,
        };

        expect((await bestPrices(db, query))[0]?.sellPriceMin).toBe(1000);
        expect(await deleteExpiredOrders(db, NOW)).toBe(1);
        expect(await deleteExpiredOrders(db, NOW)).toBe(0);
    });

    it("stores order ids above 32 bits", async () => {
        await upsertOrders(db, [order({ orderId: 3_602_731_867 })]);

        expect(await deleteExpiredOrders(db, new Date(NOW.getTime() + 48 * HOUR))).toBe(
            1,
        );
    });
});
