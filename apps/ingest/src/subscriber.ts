import type { MarketOrder, Server } from "@apc/db";
import { type NatsConnection, connect } from "@nats-io/transport-node";
import { parseBulk } from "./orders.ts";

export const ORDERS_SUBJECT = "marketorders.deduped.bulk";

export interface SubscriberStats {
    messages: number;
    orders: number;
    invalid: number;
    errors: number;
}

export interface Subscriber {
    stats: SubscriberStats;
    close(): Promise<void>;
}

/** Credentials go in the URL: nats://user:pass@host:port */
function connectionOptions(natsUrl: string) {
    const url = new URL(natsUrl);

    return {
        servers: `${url.hostname}:${url.port || 4222}`,
        user: url.username ? decodeURIComponent(url.username) : undefined,
        pass: url.password ? decodeURIComponent(url.password) : undefined,
    };
}

/** Subscribes to market orders of a server and hands every valid batch to `onOrders` */
export async function subscribe(
    server: Server,
    onOrders: (orders: MarketOrder[]) => Promise<void>,
    log: (message: string) => void,
): Promise<Subscriber> {
    const stats: SubscriberStats = { messages: 0, orders: 0, invalid: 0, errors: 0 };
    const nc: NatsConnection = await connect({
        ...connectionOptions(server.natsUrl),
        name: "apc-ingest",
        reconnect: true,
        maxReconnectAttempts: -1,
    });
    const subscription = nc.subscribe(ORDERS_SUBJECT);

    log(`[${server.id}] subscribed to ${ORDERS_SUBJECT}`);

    void (async () => {
        for await (const message of subscription) {
            try {
                const { orders, invalid } = parseBulk(
                    server.id,
                    message.json(),
                    new Date(),
                );

                await onOrders(orders);
                stats.messages++;
                stats.orders += orders.length;
                stats.invalid += invalid;
            } catch (error) {
                stats.errors++;
                log(`[${server.id}] failed to store orders: ${String(error)}`);
            }
        }
    })();

    return {
        stats,
        close: async () => {
            await nc.drain();
        },
    };
}
