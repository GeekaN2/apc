import { readFileSync } from "node:fs";
import path from "node:path";
import { type Server, getAveragePrices, seedServers } from "@apc/db";
import { createTestDb } from "@apc/db/testing";
import { readItems } from "@apc/game-data/node";
import { describe, expect, it } from "vitest";
import {
    AVERAGE_DAYS,
    aggregateCharts,
    chartsUrl,
    idBatches,
    tradableMarketIds,
} from "../src/averages.ts";
import { updateAverages } from "../src/averagesJob.ts";
import { legacyCollectDataForOneItem } from "./legacyAverages.ts";

const NOW = new Date("2026-10-28T12:00:00Z");

/** A real charts response of the Europe server for three items in three cities */
const CHARTS = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "fixtures/charts-europe.json"), "utf8"),
) as { item_id: string; location: string; data: { timestamps: string[] } }[];

const EUROPE: Server = {
    id: "europe",
    name: "Europe",
    natsUrl: "nats://localhost:4222",
    apiUrl: "https://europe.albion-online-data.com",
    isPublic: true,
    description: null,
    ownerId: null,
};

describe("aggregateCharts", () => {
    it("matches the old worker on a real response", () => {
        const rows = aggregateCharts("europe", CHARTS, NOW);

        expect(rows.length).toBeGreaterThan(0);

        for (const row of rows) {
            const legacy = legacyCollectDataForOneItem(row.itemId, CHARTS as never)[
                row.city
            ]!;

            expect(row.averagePrice, `${row.itemId} ${row.city}`).toBeCloseTo(
                legacy.averagePrice,
                9,
            );
            expect(row.averageItems, `${row.itemId} ${row.city}`).toBeCloseTo(
                legacy.averageItems,
                9,
            );
        }
    });

    it("keeps the first and last day with sales and skips items without sales", () => {
        const rows = aggregateCharts(
            "europe",
            [
                {
                    location: "Caerleon",
                    item_id: "T4_BAG",
                    quality: 1,
                    data: {
                        timestamps: ["2026-10-02T00:00:00", "2026-10-01T00:00:00"],
                        prices_avg: [100, 200],
                        item_count: [1, 3],
                    },
                },
                {
                    location: "Martlock",
                    item_id: "T4_BAG",
                    quality: 1,
                    data: {
                        timestamps: ["2026-10-01T00:00:00"],
                        prices_avg: [100],
                        item_count: [0],
                    },
                },
            ],
            NOW,
        );

        expect(rows).toEqual([
            {
                serverId: "europe",
                itemId: "T4_BAG",
                city: "Caerleon",
                averagePrice: 175,
                averageItems: 2,
                firstDate: new Date("2026-10-01T00:00:00Z"),
                lastDate: new Date("2026-10-02T00:00:00Z"),
                updatedAt: NOW,
            },
        ]);
    });
});

describe("requests", () => {
    it("asks for 30 days of every city in one request per batch", () => {
        const url = new URL(
            chartsUrl(
                "https://europe.albion-online-data.com",
                ["T4_BAG", "T5_METALBAR_LEVEL1@1"],
                NOW,
            ),
        );

        expect(url.pathname).toBe(
            "/api/v2/stats/charts/T4_BAG,T5_METALBAR_LEVEL1@1.json",
        );
        expect(url.searchParams.get("date")).toBe("9-28-2026");
        expect(url.searchParams.get("end_date")).toBe("10-28-2026");
        expect(url.searchParams.get("locations")?.split(",")).toContain("Black Market");
        expect(AVERAGE_DAYS).toBe(30);
    });

    it("splits every tradable market id into short batches", () => {
        const ids = tradableMarketIds(readItems());
        const batches = idBatches(ids);

        expect(ids).toContain("T4_MAIN_SWORD@1");
        expect(ids).toContain("T4_JOURNAL_WARRIOR_FULL");
        expect(batches.flat()).toEqual(ids);
        expect(Math.max(...batches.map((b) => b.join(",").length))).toBeLessThanOrEqual(
            3000,
        );
        expect(batches.length).toBeLessThan(120);
    });
});

describe("updateAverages", () => {
    function response(
        status: number,
        body: unknown,
        headers: Record<string, string> = {},
    ) {
        return new Response(typeof body === "string" ? body : JSON.stringify(body), {
            status,
            headers,
        });
    }

    it("stores averages, waits between requests and after throttling", async () => {
        const { db, close } = await createTestDb();
        const sleeps: number[] = [];
        const responses = [
            response(429, "Throttled", {
                "ratelimit-reset": String(NOW.getTime() / 1000 + 30),
            }),
            response(200, CHARTS),
            response(500, "Oops"),
        ];

        await seedServers(db);

        const result = await updateAverages(
            db,
            EUROPE,
            ["T4_BAG", "T4_MAIN_SWORD", "T5_METALBAR_LEVEL1@1", "x".repeat(2990)],
            {
                fetch: async () => responses.shift()!,
                sleep: async (ms) => {
                    sleeps.push(ms);
                },
                now: () => NOW,
                log: () => {},
            },
        );

        expect(result).toMatchObject({ requests: 2, failedBatches: 1 });
        expect(result.rows).toBeGreaterThan(0);
        expect(sleeps).toEqual([31_000, 2000]);
        expect(
            await getAveragePrices(db, {
                serverId: "europe",
                itemIds: ["T4_BAG"],
                cities: ["Caerleon", "Martlock", "Black Market"],
            }),
        ).toHaveLength(3);
        await close();
    });
});
