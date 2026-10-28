import { type Db, seedServers, upsertAveragePrices, upsertOrders } from "@apc/db";
import { createTestDb } from "@apc/db/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
    ({ db, close } = await createTestDb());
    await seedServers(db);
    await upsertOrders(db, [
        {
            serverId: "europe",
            orderId: 1,
            itemId: "T4_MAIN_SWORD",
            locationId: "3005",
            qualityLevel: 1,
            unitPriceSilver: 5000,
            amount: 3,
            auctionType: "offer",
            expiresAt: new Date(NOW.getTime() + DAY),
            updatedAt: NOW,
        },
        {
            serverId: "europe",
            orderId: 2,
            itemId: "T4_MAIN_SWORD",
            locationId: "3005",
            qualityLevel: 1,
            unitPriceSilver: 4000,
            amount: 1,
            auctionType: "request",
            expiresAt: new Date(NOW.getTime() + DAY),
            updatedAt: NOW,
        },
    ]);
});

afterEach(async () => {
    await close();
});

function request(path: string) {
    return createApp(db, { now: () => NOW }).request(path);
}

describe("api", () => {
    it("answers health checks", async () => {
        expect(await (await request("/api/health")).json()).toEqual({ ok: true });
    });

    it("lists public servers without NATS credentials", async () => {
        expect(await (await request("/api/servers")).json()).toEqual([
            { id: "west", name: "Americas", isPublic: true },
            { id: "east", name: "Asia", isPublic: true },
            { id: "europe", name: "Europe", isPublic: true },
        ]);
    });

    it("returns best prices in the Albion Online Data shape", async () => {
        const response = await request(
            "/api/prices?server=europe&items=T4_MAIN_SWORD,T5_MAIN_SWORD@1&cities=Caerleon,Martlock",
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([
            {
                itemId: "T4_MAIN_SWORD",
                city: "Caerleon",
                quality: 1,
                sellPriceMin: 5000,
                sellPriceMinDate: NOW.toISOString(),
                buyPriceMax: 4000,
                buyPriceMaxDate: NOW.toISOString(),
            },
        ]);
    });

    it("validates the query", async () => {
        expect(
            (await request("/api/prices?server=europe&items=T4_MAIN_SWORD")).status,
        ).toBe(400);
        expect(
            (await request("/api/prices?server=europe&items=T4_MAIN_SWORD&cities=Moscow"))
                .status,
        ).toBe(400);
        expect(
            (await request("/api/prices?server=europe&items=drop table&cities=Caerleon"))
                .status,
        ).toBe(400);
        expect(
            (await request("/api/prices?server=mars&items=T4_MAIN_SWORD&cities=Caerleon"))
                .status,
        ).toBe(404);
    });
});

describe("averages", () => {
    it("returns 30 day averages per item and city", async () => {
        await upsertAveragePrices(db, [
            {
                serverId: "europe",
                itemId: "T4_MAIN_SWORD",
                city: "Caerleon",
                averagePrice: 5200,
                averageItems: 14,
                firstDate: new Date(NOW.getTime() - 30 * DAY),
                lastDate: NOW,
                updatedAt: NOW,
            },
        ]);

        const response = await request(
            "/api/averages?server=europe&items=T4_MAIN_SWORD&cities=Caerleon,Martlock",
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([
            {
                itemId: "T4_MAIN_SWORD",
                city: "Caerleon",
                averagePrice: 5200,
                averageItems: 14,
                firstDate: new Date(NOW.getTime() - 30 * DAY).toISOString(),
                lastDate: NOW.toISOString(),
            },
        ]);
    });
});
