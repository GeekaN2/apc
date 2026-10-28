import { CITIES, type Db, bestPrices, getAveragePrices, listServers } from "@apc/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

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

export interface AppOptions {
    now?: () => Date;
}

export function createApp(db: Db, { now = () => new Date() }: AppOptions = {}) {
    return new Hono()
        .basePath("/api")
        .use(cors())
        .get("/health", (c) => c.json({ ok: true }))
        .get("/servers", async (c) => {
            const servers = await listServers(db, { publicOnly: true });

            return c.json(servers.map(({ id, name }) => ({ id, name })));
        })
        .get("/prices", zValidator("query", pricesQuery), async (c) => {
            const query = c.req.valid("query");
            const servers = await listServers(db);

            if (!servers.some((server) => server.id === query.server)) {
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
        .get("/averages", zValidator("query", itemsQuery), async (c) => {
            const query = c.req.valid("query");
            const servers = await listServers(db);

            if (!servers.some((server) => server.id === query.server)) {
                return c.json({ error: `Unknown server ${query.server}` }, 404);
            }

            const averages = await getAveragePrices(db, {
                serverId: query.server,
                itemIds: query.items,
                cities: query.cities,
            });

            return c.json(averages, 200);
        });
}

/** Type of the API for the typed `hono/client` on the frontend */
export type AppType = ReturnType<typeof createApp>;
