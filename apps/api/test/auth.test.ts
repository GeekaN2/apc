import { type Db, importLegacyData, mapLegacyData, seedServers } from "@apc/db";
import { createTestDb } from "@apc/db/testing";
import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { type Auth, createAuth } from "../src/auth.ts";

const ORIGIN = "http://localhost:5173";
const PASSWORD = "old-password";

let db: Db;
let close: () => Promise<void>;
let auth: Auth;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
    ({ db, close } = await createTestDb());
    await seedServers(db);

    const hash = bcrypt.hashSync(PASSWORD, 10);

    await importLegacyData(
        db,
        mapLegacyData(
            {
                users: [
                    {
                        _id: "64a000000000000000000001",
                        nickname: "Торговец",
                        password: hash,
                        role: "supporter",
                    },
                    {
                        _id: "64a000000000000000000002",
                        nickname: "Newbie",
                        password: hash,
                        role: "tester",
                    },
                ],
                settings: [
                    {
                        userId: "64a000000000000000000001",
                        treeSettings: { useFocus: true },
                    },
                ],
                servers: [
                    {
                        id: "guild",
                        name: "Guild",
                        natsUrl: "nats://guild.example:4222",
                        state: "private",
                        creatorId: "64a000000000000000000001",
                    },
                ],
            },
            new Date(),
        ),
    );

    auth = createAuth(db, {
        baseURL: "http://localhost:4000",
        secret: "test-secret-that-is-long-enough-for-better-auth",
        trustedOrigins: [ORIGIN],
        discord: { clientId: "discord-client", clientSecret: "discord-secret" },
    });
    app = createApp(db, { auth, trustedOrigins: [ORIGIN] });
});

afterEach(async () => {
    await close();
});

function post(path: string, body: unknown, cookie?: string) {
    return app.request(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Origin: ORIGIN,
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(body),
    });
}

/** Session cookie of a migrated user */
async function signIn(username: string, password = PASSWORD) {
    const response = await post("/api/auth/sign-in/username", { username, password });
    const cookie = response.headers.get("set-cookie")?.split(";")[0];

    return { response, cookie };
}

describe("migrated users", () => {
    it("sign in with the old nickname in any case and the old bcrypt password", async () => {
        const { response, cookie } = await signIn("тОРГОВЕЦ");

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
            user: { username: "торговец", displayUsername: "Торговец" },
        });
        expect(cookie).toMatch(/session_token=/);
    });

    it("are rejected with a wrong password", async () => {
        expect((await signIn("торговец", "wrong")).response.status).toBe(401);
    });

    it("keep their tree settings", async () => {
        const { cookie } = await signIn("торговец");
        const get = () =>
            app.request("/api/settings/tree", { headers: { Cookie: cookie! } });

        expect(await (await get()).json()).toEqual({ treeSettings: { useFocus: true } });

        const put = await app.request("/api/settings/tree", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Cookie: cookie! },
            body: JSON.stringify({ useFocus: false, city: "Martlock" }),
        });

        expect(put.status).toBe(200);
        expect(await (await get()).json()).toEqual({
            treeSettings: { useFocus: false, city: "Martlock" },
        });
        expect((await app.request("/api/settings/tree")).status).toBe(401);
    });

    it("keep their roles", async () => {
        const can = (userId: string) =>
            auth.api.userHasPermission({
                body: { userId, permissions: { server: ["create"] } },
            });

        expect((await can("64a000000000000000000001")).success).toBe(true);
        expect((await can("64a000000000000000000002")).success).toBe(false);
    });
});

describe("private servers", () => {
    it("are visible to their owner only", async () => {
        const { cookie } = await signIn("торговец");
        const servers = async (headers: Record<string, string> = {}) =>
            (
                (await (await app.request("/api/servers", { headers })).json()) as {
                    id: string;
                }[]
            ).map((s) => s.id);
        const prices = (headers: Record<string, string> = {}) =>
            app.request("/api/prices?server=guild&items=T4_BAG&cities=Caerleon", {
                headers,
            });

        expect(await servers()).toEqual(["west", "east", "europe"]);
        expect(await servers({ Cookie: cookie! })).toEqual([
            "west",
            "east",
            "europe",
            "guild",
        ]);
        expect((await prices()).status).toBe(404);
        expect((await prices({ Cookie: cookie! })).status).toBe(200);
    });
});

describe("new users", () => {
    it("cannot sign up with a password", async () => {
        const response = await post("/api/auth/sign-up/email", {
            email: "new@example.com",
            password: "password1234",
            name: "New",
        });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("sign in with Discord", async () => {
        const response = await post("/api/auth/sign-in/social", {
            provider: "discord",
            callbackURL: ORIGIN,
        });
        const { url } = (await response.json()) as { url: string };

        expect(response.status).toBe(200);
        expect(new URL(url).origin).toBe("https://discord.com");
        expect(new URL(url).searchParams.get("client_id")).toBe("discord-client");
        expect(new URL(url).searchParams.get("redirect_uri")).toBe(
            "http://localhost:4000/api/auth/callback/discord",
        );
    });
});
