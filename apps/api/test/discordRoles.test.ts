import { type Db, user } from "@apc/db";
import { createTestDb } from "@apc/db/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { syncDiscordRole } from "../src/discordRoles.ts";

const ROLES = { guildId: "guild", supporterRoleIds: ["patron", "booster"] };
const NOW = new Date("2026-10-29T12:00:00Z");

let db: Db;
let close: () => Promise<void>;

beforeEach(async () => {
    ({ db, close } = await createTestDb());
    await db.insert(user).values(
        (["user", "admin"] as const).map((role) => ({
            id: role,
            name: role,
            email: `${role}@test.invalid`,
            emailVerified: false,
            role,
            createdAt: NOW,
            updatedAt: NOW,
        })),
    );
});

afterEach(async () => {
    await close();
});

/** Discord answering the member request with roles, or with a status */
function discord(answer: string[] | number) {
    const requests: { url: string; authorization: string | null }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
        requests.push({
            url,
            authorization: new Headers(init?.headers).get("Authorization"),
        });

        return typeof answer === "number"
            ? new Response(null, { status: answer })
            : Response.json({ roles: answer });
    }) as typeof fetch;

    return { fetchImpl, requests };
}

async function roleOf(id: string) {
    const rows = await db.select({ id: user.id, role: user.role }).from(user);

    return rows.find((r) => r.id === id)?.role;
}

const account = (userId: string) => ({
    providerId: "discord",
    userId,
    accessToken: "token",
});

describe("syncDiscordRole", () => {
    it("makes members with a supporter role supporters", async () => {
        const { fetchImpl, requests } = discord(["other", "booster"]);

        expect(await syncDiscordRole(db, account("user"), ROLES, fetchImpl)).toBe(true);
        expect(await roleOf("user")).toBe("supporter");
        expect(requests).toEqual([
            {
                url: "https://discord.com/api/v10/users/@me/guilds/guild/member",
                authorization: "Bearer token",
            },
        ]);
    });

    it("leaves members without one and people outside the server as they are", async () => {
        expect(
            await syncDiscordRole(
                db,
                account("user"),
                ROLES,
                discord(["other"]).fetchImpl,
            ),
        ).toBe(false);
        expect(
            await syncDiscordRole(db, account("user"), ROLES, discord(404).fetchImpl),
        ).toBe(false);
        expect(await roleOf("user")).toBe("user");
    });

    it("never lowers admins", async () => {
        expect(
            await syncDiscordRole(
                db,
                account("admin"),
                ROLES,
                discord(["patron"]).fetchImpl,
            ),
        ).toBe(false);
        expect(await roleOf("admin")).toBe("admin");
    });

    it("ignores other providers and accounts without a token", async () => {
        const { fetchImpl, requests } = discord(["patron"]);

        await syncDiscordRole(
            db,
            { ...account("user"), providerId: "credential" },
            ROLES,
            fetchImpl,
        );
        await syncDiscordRole(
            db,
            { ...account("user"), accessToken: null },
            ROLES,
            fetchImpl,
        );

        expect(requests).toEqual([]);
    });
});
