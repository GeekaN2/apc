import {
    CITIES,
    type Db,
    bestPrices,
    cityAverages,
    cityPrices,
    getAveragePrices,
    getTreeSettings,
    listVisibleServers,
    saveTreeSettings,
} from "@apc/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import type { Auth } from "./auth.ts";

const MAX_ITEMS = 1000;

/** Comma separated query parameter: `a,b,c` */
function list<T extends z.ZodType<unknown, string>>(item: T) {
    return z
        .string()
        .transform((value) =>
            value
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean),
        )
        .pipe(z.array(item).min(1));
}

const itemsQuery = z.object({
    server: z.string().min(1),
    items: list(z.string().regex(/^[A-Z0-9_]+(@\d)?$/)).pipe(
        z.array(z.string()).max(MAX_ITEMS),
    ),
    cities: list(z.enum(CITIES)),
});

const pricesQuery = itemsQuery.extend({
    qualities: list(
        z
            .string()
            .regex(/^[1-5]$/)
            .transform(Number),
    ).default([1]),
});

/** How long a city snapshot is served from memory */
export const MARKET_CACHE_MS = 60_000;

/**
 * Best orders of every item in a city, column by column to stay small: row i is
 * `items[i]` of quality `qualities[i]`. Ages are minutes before `generatedAt`, −1
 * without an order. Averages are per item over all qualities.
 */
export interface MarketSnapshot {
    city: (typeof CITIES)[number];
    generatedAt: string;
    items: string[];
    qualities: number[];
    sell: number[];
    sellAge: number[];
    buy: number[];
    buyAge: number[];
    averages: { items: string[]; averageItems: number[]; averagePrice: number[] };
}

function ageInMinutes(date: Date | null, now: Date): number {
    return date ? Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000)) : -1;
}

export interface AppOptions {
    now?: () => Date;
    /** Without auth every request is anonymous */
    auth?: Auth;
    /** Frontend origins allowed to send cookies; any origin without credentials otherwise */
    trustedOrigins?: string[];
}

interface Env {
    Variables: { userId: string | undefined };
}

export function createApp(
    db: Db,
    { now = () => new Date(), auth, trustedOrigins }: AppOptions = {},
) {
    const marketCache = new Map<string, { expires: number; snapshot: MarketSnapshot }>();

    async function marketSnapshot(
        serverId: string,
        city: (typeof CITIES)[number],
    ): Promise<MarketSnapshot> {
        const key = `${serverId}|${city}`;
        const at = now();
        const cached = marketCache.get(key);

        if (cached && cached.expires > at.getTime()) {
            return cached.snapshot;
        }

        const [quotes, averages] = await Promise.all([
            cityPrices(db, { serverId, city, now: at }),
            cityAverages(db, { serverId, city }),
        ]);
        const snapshot: MarketSnapshot = {
            city,
            generatedAt: at.toISOString(),
            items: quotes.map((q) => q.itemId),
            qualities: quotes.map((q) => q.quality),
            sell: quotes.map((q) => q.sellPriceMin),
            sellAge: quotes.map((q) => ageInMinutes(q.sellPriceMinDate, at)),
            buy: quotes.map((q) => q.buyPriceMax),
            buyAge: quotes.map((q) => ageInMinutes(q.buyPriceMaxDate, at)),
            averages: {
                items: averages.map((a) => a.itemId),
                averageItems: averages.map((a) => Math.round(a.averageItems * 10) / 10),
                averagePrice: averages.map((a) => Math.round(a.averagePrice)),
            },
        };

        marketCache.set(key, { expires: at.getTime() + MARKET_CACHE_MS, snapshot });

        return snapshot;
    }

    /** Public servers and private ones of the signed in user */
    async function isVisible(serverId: string, userId: string | undefined) {
        const servers = await listVisibleServers(db, userId);

        return servers.some((server) => server.id === serverId);
    }

    return new Hono<Env>()
        .basePath("/api")
        .use(
            cors(
                trustedOrigins
                    ? { origin: trustedOrigins, credentials: true }
                    : { origin: "*" },
            ),
        )
        .on(["GET", "POST"], "/auth/*", (c) =>
            auth ? auth.handler(c.req.raw) : c.json({ error: "Auth is disabled" }, 404),
        )
        .use(async (c, next) => {
            const session = await auth?.api.getSession({ headers: c.req.raw.headers });

            c.set("userId", session?.user.id);
            await next();
        })
        .get("/health", (c) => c.json({ ok: true }))
        .get("/servers", async (c) => {
            const servers = await listVisibleServers(db, c.get("userId"));

            return c.json(
                servers.map(({ id, name, isPublic }) => ({ id, name, isPublic })),
            );
        })
        .get("/prices", zValidator("query", pricesQuery), async (c) => {
            const query = c.req.valid("query");

            if (!(await isVisible(query.server, c.get("userId")))) {
                return c.json({ error: `Unknown server ${query.server}` }, 404);
            }

            const quotes = await bestPrices(db, {
                serverId: query.server,
                itemIds: query.items,
                cities: query.cities,
                qualities: query.qualities,
                now: now(),
            });

            return c.json(quotes, 200);
        })
        .get(
            "/market",
            zValidator(
                "query",
                z.object({ server: z.string().min(1), city: z.enum(CITIES) }),
            ),
            async (c) => {
                const { server, city } = c.req.valid("query");

                if (!(await isVisible(server, c.get("userId")))) {
                    return c.json({ error: `Unknown server ${server}` }, 404);
                }

                c.header("Cache-Control", `private, max-age=${MARKET_CACHE_MS / 1000}`);

                return c.json(await marketSnapshot(server, city), 200);
            },
        )
        .get("/averages", zValidator("query", itemsQuery), async (c) => {
            const query = c.req.valid("query");

            if (!(await isVisible(query.server, c.get("userId")))) {
                return c.json({ error: `Unknown server ${query.server}` }, 404);
            }

            const averages = await getAveragePrices(db, {
                serverId: query.server,
                itemIds: query.items,
                cities: query.cities,
            });

            return c.json(averages, 200);
        })
        .get("/settings/tree", async (c) => {
            const userId = c.get("userId");

            if (!userId) {
                return c.json({ error: "Sign in to load settings" }, 401);
            }

            return c.json({ treeSettings: await getTreeSettings(db, userId) }, 200);
        })
        .put(
            "/settings/tree",
            zValidator("json", z.record(z.string(), z.unknown())),
            async (c) => {
                const userId = c.get("userId");

                if (!userId) {
                    return c.json({ error: "Sign in to save settings" }, 401);
                }

                await saveTreeSettings(db, userId, c.req.valid("json"));

                return c.json({ ok: true }, 200);
            },
        );
}

/** Type of the API for the typed `hono/client` on the frontend */
export type AppType = ReturnType<typeof createApp>;
