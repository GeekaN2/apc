import { type MarketOrder, normalizeLocationId } from "@apc/db";
import { z } from "zod";

const DAY = 24 * 60 * 60 * 1000;

/**
 * The game keeps orders for 30 days, but an order not seen for two weeks is most
 * likely gone; the old ingest used the same limit
 */
export const ORDER_MAX_LIFETIME_MS = 14 * DAY;

/** One order of `marketorders.deduped.bulk` */
const natsOrder = z.object({
    Id: z.number().int().positive(),
    ItemTypeId: z.string().min(1),
    LocationId: z.union([z.number().int(), z.string().regex(/^\d+$/)]),
    QualityLevel: z.number().int().min(1).max(5),
    UnitPriceSilver: z.number().int().nonnegative(),
    Amount: z.number().int().nonnegative(),
    AuctionType: z.enum(["offer", "request"]),
    Expires: z.string(),
});

/** NATS sends `Expires` without a time zone; it is UTC */
export function parseExpires(expires: string): Date {
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(expires);

    return new Date(hasZone ? expires : `${expires}Z`);
}

export interface ParsedBulk {
    orders: MarketOrder[];
    invalid: number;
}

/** Validates a bulk message; invalid orders are skipped, repeated ones keep the last */
export function parseBulk(serverId: string, data: unknown, now: Date): ParsedBulk {
    const list = Array.isArray(data) ? data : [data];
    const orders = new Map<number, MarketOrder>();
    let invalid = 0;

    for (const raw of list) {
        const parsed = natsOrder.safeParse(raw);
        const expires = parsed.success ? parseExpires(parsed.data.Expires) : undefined;

        if (!parsed.success || !expires || Number.isNaN(expires.getTime())) {
            invalid++;
            continue;
        }

        const order = parsed.data;
        const maxExpires = now.getTime() + ORDER_MAX_LIFETIME_MS;

        orders.set(order.Id, {
            serverId,
            orderId: order.Id,
            itemId: order.ItemTypeId,
            locationId: normalizeLocationId(order.LocationId),
            qualityLevel: order.QualityLevel,
            unitPriceSilver: order.UnitPriceSilver,
            amount: order.Amount,
            auctionType: order.AuctionType,
            expiresAt: new Date(Math.min(expires.getTime(), maxExpires)),
            updatedAt: now,
        });
    }

    return { orders: [...orders.values()], invalid };
}
