/** Market orders ingest: NATS of every server in the database → Postgres */
import {
    type Server,
    createDb,
    deleteExpiredOrders,
    listServers,
    upsertOrders,
} from "@apc/db";
import { type Subscriber, subscribe } from "./subscriber.ts";

const STATS_INTERVAL_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const RECONNECT_DELAY_MS = 60 * 1000;

const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not set");
}

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);
const { db, close } = createDb(url);
const subscribers = new Map<string, Subscriber>();
const retryTimers = new Set<NodeJS.Timeout>();

/** Connects to a server, retrying until the first connection succeeds */
async function start(server: Server) {
    try {
        subscribers.set(
            server.id,
            await subscribe(server, (orders) => upsertOrders(db, orders), log),
        );
    } catch (error) {
        log(`[${server.id}] failed to connect, retrying in a minute: ${String(error)}`);

        const timer = setTimeout(() => {
            retryTimers.delete(timer);
            void start(server);
        }, RECONNECT_DELAY_MS);

        retryTimers.add(timer);
    }
}

for (const server of await listServers(db)) {
    void start(server);
}

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

async function shutdown() {
    clearInterval(statsTimer);
    clearInterval(cleanupTimer);
    retryTimers.forEach(clearTimeout);
    await Promise.all([...subscribers.values()].map((s) => s.close()));
    await close();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
