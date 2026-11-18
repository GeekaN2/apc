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
    readonly connected: boolean;
    close(): Promise<void>;
}

/** Supports NATS URLs with optional credentials and explicit TLS. */
function connectionOptions(natsUrl: string) {
    const url = new URL(natsUrl);

    return {
        servers: `${url.hostname}:${url.port || 4222}`,
        tls: url.protocol === "tls:" ? {} : undefined,
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
    let connected = true;

    log(`[${server.id}] subscribed to ${ORDERS_SUBJECT}`);

    void (async () => {
        for await (const status of nc.status()) {
            if (status.type === "disconnect" || status.type === "close") {
                connected = false;
            } else if (status.type === "reconnect") {
                connected = true;
            }
        }
    })();

    const receiving = (async () => {
        try {
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
        } catch (error) {
            stats.errors++;
            log(`[${server.id}] order subscription failed: ${String(error)}`);
        }
    })();

    return {
        stats,
        get connected() {
            return connected && !nc.isClosed() && !subscription.isClosed();
        },
        close: async () => {
            await nc.drain();
            await receiving;
        },
    };
}
