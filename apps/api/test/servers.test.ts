import { type Db, seedServers, upsertOrders, user } from "@apc/db";
import { createTestDb } from "@apc/db/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_PRIVATE_SERVERS, createApp } from "../src/app.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const USERS = {
    owner: { id: "owner", role: "supporter", username: "owner" },
    other: { id: "other", role: "supporter", username: "other" },
    friend: { id: "friend", role: "user", username: "friend" },
    admin: { id: "admin", role: "admin", username: "admin" },
};

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
    ({ db, close } = await createTestDb());
    await seedServers(db);
    await db.insert(user).values(
        Object.values(USERS).map((u) => ({
            id: u.id,
            name: u.username,
            email: `${u.id}@test.invalid`,
            emailVerified: false,
            username: u.username,
            displayUsername: u.username === "friend" ? "Friend" : u.username,
            role: u.role,
            createdAt: NOW,
            updatedAt: NOW,
        })),
    );
});

afterEach(async () => {
    await close();
});

/** Requests as a user from USERS, or anonymously */
function as(name?: keyof typeof USERS) {
    const app = createApp(db, {
        now: () => NOW,
        user: async () => (name ? USERS[name] : undefined),
    });

    return (path: string, init?: { method: string; body?: unknown }) =>
        app.request(path, {
            method: init?.method ?? "GET",
            headers: { "Content-Type": "application/json" },
            body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        });
}

const SERVER = {
    id: "guild-eu",
    name: "Guild",
    description: "Our prices",
    natsUrl: "nats://guild:secret@nats.example.com:4222",
    access: ["Friend", "ghost"],
};

describe("private servers", () => {
    it("are created by supporters with an access list by nickname", async () => {
        const created = await as("owner")("/api/servers", {
            method: "POST",
            body: SERVER,
        });

        expect(created.status).toBe(201);
        expect(await created.json()).toEqual({ unknown: ["ghost"] });
        expect(await (await as("owner")("/api/servers/private")).json()).toEqual([
            {
                id: "guild-eu",
                name: "Guild",
                description: "Our prices",
                natsUrl: SERVER.natsUrl,
                ownerId: "owner",
                access: ["Friend"],
            },
        ]);
    });

    it("are visible with their NATS URL to the owner and the access list only", async () => {
        await as("owner")("/api/servers", { method: "POST", body: SERVER });

        const ids = async (name?: keyof typeof USERS) =>
            ((await (await as(name)("/api/servers")).json()) as { id: string }[]).map(
                (s) => s.id,
            );

        expect(await ids("friend")).toContain("guild-eu");
        expect(await ids("other")).not.toContain("guild-eu");
        expect(await ids()).not.toContain("guild-eu");

        const servers = (await (await as("friend")("/api/servers")).json()) as {
            id: string;
            natsUrl?: string;
        }[];

        expect(servers.find((s) => s.id === "guild-eu")?.natsUrl).toBe(SERVER.natsUrl);
        expect(servers.find((s) => s.id === "europe")?.natsUrl).toBeUndefined();
    });

    it("are not for regular users", async () => {
        expect(
            (await as("friend")("/api/servers", { method: "POST", body: SERVER })).status,
        ).toBe(403);
        expect((await as("friend")("/api/servers/private")).status).toBe(403);
    });

    it("are changed by their owner or an admin only", async () => {
        await as("owner")("/api/servers", { method: "POST", body: SERVER });

        const update = { ...SERVER, name: "Renamed", access: [] };
        const put = (name: keyof typeof USERS) =>
            as(name)("/api/servers/guild-eu", { method: "PUT", body: update });

        expect((await put("other")).status).toBe(403);
        expect((await put("admin")).status).toBe(200);
        expect(await (await as("admin")("/api/servers/private")).json()).toMatchObject([
            { id: "guild-eu", name: "Renamed", access: [] },
        ]);
    });

    it("validate ids and NATS URLs", async () => {
        const post = (body: unknown) =>
            as("owner")("/api/servers", { method: "POST", body });

        expect((await post({ ...SERVER, id: "Bad Id" })).status).toBe(400);
        expect((await post({ ...SERVER, natsUrl: "http://example.com" })).status).toBe(
            400,
        );
        expect((await post({ ...SERVER, id: "europe" })).status).toBe(409);
    });

    it("can't touch public servers", async () => {
        expect(
            (await as("admin")("/api/servers/europe", { method: "DELETE" })).status,
        ).toBe(404);
    });

    it("are deleted with their orders", async () => {
        await as("owner")("/api/servers", { method: "POST", body: SERVER });
        await upsertOrders(db, [
            {
                serverId: "guild-eu",
                orderId: 1,
                itemId: "T4_BAG",
                locationId: "3005",
                qualityLevel: 1,
                unitPriceSilver: 100,
                amount: 1,
                auctionType: "offer",
                expiresAt: new Date(NOW.getTime() + 60_000),
                updatedAt: NOW,
            },
        ]);

        const deleted = await as("owner")("/api/servers/guild-eu", { method: "DELETE" });

        expect(deleted.status).toBe(200);
        expect(await (await as("owner")("/api/servers/private")).json()).toEqual([]);
    });

    it("are limited per supporter", async () => {
        for (let i = 0; i < MAX_PRIVATE_SERVERS; i++) {
            await as("owner")("/api/servers", {
                method: "POST",
                body: { ...SERVER, id: `guild-${i}` },
            });
        }

        const extra = await as("owner")("/api/servers", {
            method: "POST",
            body: { ...SERVER, id: "guild-extra" },
        });

        expect(extra.status).toBe(403);
    });
});

describe("admin stats", () => {
    it("counts live orders per server for admins only", async () => {
        await upsertOrders(db, [
            {
                serverId: "europe",
                orderId: 1,
                itemId: "T4_BAG",
                locationId: "3005",
                qualityLevel: 1,
                unitPriceSilver: 100,
                amount: 1,
                auctionType: "offer",
                expiresAt: new Date(NOW.getTime() + 60_000),
                updatedAt: NOW,
            },
        ]);

        expect((await as("owner")("/api/admin/stats")).status).toBe(403);

        const stats = (await (await as("admin")("/api/admin/stats")).json()) as {
            id: string;
            liveOrders: number;
            lastOrderAt: string | null;
        }[];

        expect(stats.find((s) => s.id === "europe")).toMatchObject({
            liveOrders: 1,
            lastOrderAt: NOW.toISOString(),
        });
        expect(stats.find((s) => s.id === "west")).toMatchObject({
            liveOrders: 0,
            lastOrderAt: null,
        });
    });
});
