import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { type LegacyData, importLegacyData, mapLegacyData } from "../src/legacy.ts";
import { account, serverAccess, servers, user, userSettings } from "../src/schema.ts";
import { seedServers } from "../src/servers.ts";
import { createTestDb } from "../src/testing.ts";

const NOW = new Date("2026-10-28T12:00:00Z");
const HASH = "$2b$10$abcdefghijklmnopqrstuuJ2e3y4z5A6B7C8D9E0F1G2H3I4J5K6L";

const LEGACY: LegacyData = {
    users: [
        {
            _id: { toHexString: () => "64a000000000000000000001" },
            nickname: "GeekaN",
            password: HASH,
            role: "admin",
            dtCreated: "2020-05-01T00:00:00Z",
        },
        {
            _id: "64a000000000000000000002",
            nickname: "Тестер",
            password: HASH,
            role: "tester",
        },
        {
            _id: "64a000000000000000000003",
            nickname: "Trader",
            password: HASH,
            role: "supporter",
        },
        {
            _id: "64a000000000000000000004",
            nickname: "geekan",
            password: HASH,
            role: "user",
        },
        { _id: "64a000000000000000000005", nickname: " ", password: HASH },
    ],
    settings: [
        { userId: "64a000000000000000000001", treeSettings: { useFocus: true } },
        { userId: "64a00000000000000000ffff", treeSettings: { useFocus: false } },
    ],
    servers: [
        {
            id: "aod_west",
            name: "aod_west",
            natsUrl: "nats://public:thenewalbiondata@albion-online-data.com:4222",
            state: "public",
        },
        {
            id: "guild",
            name: "Guild",
            description: "Our guild data",
            natsUrl: "nats://guild.example:4222",
            state: "private",
            creatorId: "64a000000000000000000003",
            access: [
                { type: "user", nickname: "тестер" },
                { type: "user", nickname: "Ghost" },
            ],
        },
    ],
};

describe("mapLegacyData", () => {
    const data = mapLegacyData(LEGACY, NOW);

    it("keeps old ids, lowercases usernames and maps roles", () => {
        expect(
            data.users.map((u) => [u.id, u.username, u.displayUsername, u.role]),
        ).toEqual([
            ["64a000000000000000000001", "geekan", "GeekaN", "admin"],
            ["64a000000000000000000002", "тестер", "Тестер", "user"],
            ["64a000000000000000000003", "trader", "Trader", "supporter"],
        ]);
        expect(data.users[0]).toMatchObject({
            email: "64a000000000000000000001@legacy.invalid",
            createdAt: new Date("2020-05-01T00:00:00Z"),
        });
    });

    it("moves bcrypt hashes into credential accounts", () => {
        expect(data.accounts[0]).toMatchObject({
            accountId: "64a000000000000000000001",
            providerId: "credential",
            userId: "64a000000000000000000001",
            password: HASH,
        });
    });

    it("skips taken and empty nicknames", () => {
        expect(data.skipped).toEqual([
            "user 64a000000000000000000004: nickname geekan is taken",
            "user 64a000000000000000000005: no nickname or password",
            "server guild: no user Ghost",
        ]);
    });

    it("keeps settings of imported users only", () => {
        expect(data.settings).toEqual([
            {
                userId: "64a000000000000000000001",
                treeSettings: { useFocus: true },
                updatedAt: NOW,
            },
        ]);
    });

    it("imports private servers with owners and access by nickname", () => {
        expect(data.servers).toEqual([
            {
                id: "guild",
                name: "Guild",
                description: "Our guild data",
                natsUrl: "nats://guild.example:4222",
                apiUrl: null,
                isPublic: false,
                ownerId: "64a000000000000000000003",
            },
        ]);
        expect(data.access).toEqual([
            { serverId: "guild", userId: "64a000000000000000000002" },
        ]);
    });
});

describe("importLegacyData", () => {
    it("writes everything once and can be run again", async () => {
        const { db, close } = await createTestDb();
        const data = mapLegacyData(LEGACY, NOW);

        await seedServers(db);
        await importLegacyData(db, data);
        await importLegacyData(db, data);

        expect(await db.select().from(user)).toHaveLength(3);
        expect(await db.select().from(account)).toHaveLength(3);
        expect(await db.select().from(userSettings)).toHaveLength(1);
        expect(await db.select().from(serverAccess)).toHaveLength(1);
        expect(
            await db.select().from(servers).where(eq(servers.id, "guild")),
        ).toHaveLength(1);
        await close();
    });
});
