import type { Server } from "@apc/db";
import { connect } from "@nats-io/transport-node";
import { expect, it, vi } from "vitest";
import { subscribe } from "../src/subscriber.ts";

vi.mock(import("@nats-io/transport-node"), () => ({ connect: vi.fn() }));

it.each([
    {
        url: "tls://nats.albion-profit-calculator.com:24222",
        address: "nats.albion-profit-calculator.com:24222",
        tls: {},
        user: undefined,
        pass: undefined,
    },
    {
        url: "tls://test:p%40ss@broker.example:24222",
        address: "broker.example:24222",
        tls: {},
        user: "test",
        pass: "p@ss",
    },
    {
        url: "nats://broker.example",
        address: "broker.example:4222",
        tls: undefined,
        user: undefined,
        pass: undefined,
    },
])(
    "uses the transport and credentials for $url",
    async ({ url, address, tls, user, pass }) => {
        const server: Server = {
            id: "test",
            name: "Test server",
            description: null,
            natsUrl: url,
            apiUrl: null,
            isPublic: true,
            ownerId: null,
            ingestConnected: null,
            ingestCheckedAt: null,
        };
        const error = new Error("Test connection stopped");
        vi.mocked(connect).mockRejectedValueOnce(error);

        await expect(subscribe(server, vi.fn(), vi.fn())).rejects.toBe(error);
        expect(connect).toHaveBeenLastCalledWith(
            expect.objectContaining({ servers: address, tls, user, pass }),
        );
    },
);
