import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    getAveragePrices,
    lastAveragesUpdate,
    upsertAveragePrices,
} from "../src/averages.ts";
import type { Db } from "../src/client.ts";
import { OVERPRICED_FACTOR, bestPrices, upsertOrders } from "../src/orders.ts";
import type { AveragePrice, MarketOrder } from "../src/schema.ts";
import { listServers, seedServers } from "../src/servers.ts";
import { createTestDb } from "../src/testing.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
    ({ db, close } = await createTestDb());
    await seedServers(db);
});

afterEach(async () => {
    await close();
});

function average(overrides: Partial<AveragePrice> = {}): AveragePrice {
    return {
        serverId: "europe",
        itemId: "T4_BAG",
        city: "Caerleon",
        averagePrice: 2000,
        averageItems: 12.5,
        firstDate: new Date(NOW.getTime() - 30 * DAY),
        lastDate: new Date(NOW.getTime() - DAY),
        updatedAt: NOW,
        ...overrides,
    };
}

function offer(orderId: number, unitPriceSilver: number): MarketOrder {
    return {
        serverId: "europe",
        orderId,
        itemId: "T4_BAG",
        locationId: "3005",
        qualityLevel: 1,
        unitPriceSilver,
        amount: 1,
        auctionType: "offer",
        expiresAt: new Date(NOW.getTime() + DAY),
        updatedAt: NOW,
    };
}

describe("servers", () => {
    it("know the price history API of public servers", async () => {
        expect((await listServers(db)).map((s) => s.apiUrl)).toEqual([
            "https://west.albion-online-data.com",
            "https://east.albion-online-data.com",
            "https://europe.albion-online-data.com",
        ]);
    });
});

describe("average prices", () => {
    it("upserts and reads averages by item and city", async () => {
        await upsertAveragePrices(db, [average(), average({ city: "Martlock" })]);
        await upsertAveragePrices(db, [average({ averagePrice: 2100 })]);

        const rows = await getAveragePrices(db, {
            serverId: "europe",
            itemIds: ["T4_BAG"],
            cities: ["Caerleon"],
        });

        expect(rows).toEqual([
            {
                itemId: "T4_BAG",
                city: "Caerleon",
                averagePrice: 2100,
                averageItems: 12.5,
                firstDate: new Date(NOW.getTime() - 30 * DAY),
                lastDate: new Date(NOW.getTime() - DAY),
            },
        ]);
    });

    it("tells when averages of a server were updated", async () => {
        expect(await lastAveragesUpdate(db, "europe")).toBeUndefined();

        await upsertAveragePrices(db, [average()]);

        expect(await lastAveragesUpdate(db, "europe")).toEqual(NOW);
        expect(await lastAveragesUpdate(db, "west")).toBeUndefined();
    });
});

describe("overpriced orders", () => {
    const query = {
        serverId: "europe",
        itemIds: ["T4_BAG"],
        cities: ["Caerleon" as const],
        qualities: [1],
        now: NOW,
    };

    it("ignores sell orders priced far above the average", async () => {
        await upsertAveragePrices(db, [average({ averagePrice: 2000 })]);
        await upsertOrders(db, [offer(1, 2000 * OVERPRICED_FACTOR + 1), offer(2, 9000)]);

        expect((await bestPrices(db, query))[0]?.sellPriceMin).toBe(9000);
    });

    it("drops the item when it has only trolling orders", async () => {
        await upsertAveragePrices(db, [average({ averagePrice: 2000 })]);
        await upsertOrders(db, [offer(1, 999_999_999)]);

        expect(await bestPrices(db, query)).toEqual([]);
    });

    it("keeps every order without an average", async () => {
        await upsertOrders(db, [offer(1, 999_999_999)]);

        expect((await bestPrices(db, query))[0]?.sellPriceMin).toBe(999_999_999);
    });
});
