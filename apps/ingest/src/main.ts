/**
 * Market data ingest: orders from NATS of every server in the database and
 * daily 30 day averages from the Albion Online Data API → Postgres
 */
import {
    type Server,
    createDb,
    deleteExpiredOrders,
    lastAveragesUpdate,
    listServers,
    upsertOrders,
} from "@apc/db";
import { readItems } from "@apc/game-data/node";
import { tradableMarketIds } from "./averages.ts";
import { updateAverages } from "./averagesJob.ts";
import { type Subscriber, subscribe } from "./subscriber.ts";

const STATS_INTERVAL_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const RECONNECT_DELAY_MS = 60 * 1000;
const SERVERS_SYNC_MS = 60 * 1000;
const AVERAGES_MAX_AGE_MS = 20 * 60 * 60 * 1000;
const AVERAGES_CHECK_MS = 60 * 60 * 1000;

const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not set");
}

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);
const { db, close } = createDb(url);
const subscribers = new Map<string, Subscriber>();
const retryTimers = new Map<string, NodeJS.Timeout>();
/** NATS URL each server was started with, to restart it when the URL changes */
const started = new Map<string, string>();

/** Connects to a server, retrying until the first connection succeeds */
async function start(server: Server) {
    started.set(server.id, server.natsUrl);

    try {
        const subscriber = await subscribe(
            server,
            (orders) => upsertOrders(db, orders),
            log,
        );

        // Stopped or changed while connecting
        if (started.get(server.id) !== server.natsUrl) {
            await subscriber.close();

            return;
        }

        subscribers.set(server.id, subscriber);
    } catch (error) {
        log(`[${server.id}] failed to connect, retrying in a minute: ${String(error)}`);

        retryTimers.set(
            server.id,
            setTimeout(() => {
                retryTimers.delete(server.id);

                if (started.get(server.id) === server.natsUrl) {
                    void start(server);
                }
            }, RECONNECT_DELAY_MS),
        );
    }
}

async function stop(serverId: string) {
    started.delete(serverId);
    clearTimeout(retryTimers.get(serverId));
    retryTimers.delete(serverId);
    await subscribers.get(serverId)?.close();
    subscribers.delete(serverId);
}

/**
 * Follows the servers in the database: supporters add, change and delete private
 * servers while the ingest runs
 */
async function syncServers() {
    try {
        const servers = await listServers(db);
        const ids = new Set(servers.map((server) => server.id));

        for (const serverId of started.keys()) {
            if (!ids.has(serverId)) {
                log(`[${serverId}] removed, disconnecting`);
                await stop(serverId);
            }
        }

        for (const server of servers) {
            const natsUrl = started.get(server.id);

            if (natsUrl === server.natsUrl) {
                continue;
            }

            if (natsUrl !== undefined) {
                log(`[${server.id}] NATS URL changed, reconnecting`);
                await stop(server.id);
            }

            void start(server);
        }
    } catch (error) {
        log(`failed to sync servers: ${String(error)}`);
    }
}

await syncServers();

const syncTimer = setInterval(syncServers, SERVERS_SYNC_MS);

const statsTimer = setInterval(() => {
    for (const [serverId, { stats }] of subscribers) {
        log(
            `[${serverId}] ${stats.messages} messages, ${stats.orders} orders, ` +
                `${stats.invalid} invalid, ${stats.errors} errors`,
        );
        Object.assign(stats, { messages: 0, orders: 0, invalid: 0, errors: 0 });
    }
}, STATS_INTERVAL_MS);

const cleanupTimer = setInterval(async () => {
    try {
        log(`deleted ${await deleteExpiredOrders(db, new Date())} expired orders`);
    } catch (error) {
        log(`failed to delete expired orders: ${String(error)}`);
    }
}, CLEANUP_INTERVAL_MS);

const itemIds = tradableMarketIds(readItems());
let averagesRunning = false;

/** Updates averages of servers whose averages are older than a day, one at a time */
async function refreshAverages() {
    if (averagesRunning) {
        return;
    }

    averagesRunning = true;

    try {
        for (const server of await listServers(db)) {
            const updated = await lastAveragesUpdate(db, server.id);

            if (
                !server.apiUrl ||
                (updated && Date.now() - updated.getTime() < AVERAGES_MAX_AGE_MS)
            ) {
                continue;
            }

            log(`[${server.id}] updating averages of ${itemIds.length} items`);

            const result = await updateAverages(db, server, itemIds, { log });

            log(
                `[${server.id}] averages: ${result.rows} rows from ${result.requests} requests, ` +
                    `${result.failedBatches} failed`,
            );
        }
    } catch (error) {
        log(`failed to update averages: ${String(error)}`);
    } finally {
        averagesRunning = false;
    }
}

const averagesEnabled = process.env.INGEST_AVERAGES !== "false";
const averagesTimer = averagesEnabled
    ? setInterval(refreshAverages, AVERAGES_CHECK_MS)
    : undefined;

if (averagesEnabled) {
    void refreshAverages();
}

async function shutdown() {
    clearInterval(statsTimer);
    clearInterval(cleanupTimer);
    clearInterval(averagesTimer);
    clearInterval(syncTimer);
    retryTimers.forEach(clearTimeout);
    await Promise.all([...subscribers.values()].map((s) => s.close()));
    await close();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
