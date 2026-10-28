import {
    bigint,
    boolean,
    doublePrecision,
    index,
    integer,
    pgTable,
    primaryKey,
    smallint,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

/** Albion Online Data servers: NATS sources of market orders */
export const servers = pgTable("servers", {
    id: text().primaryKey(),
    name: text().notNull(),
    natsUrl: text("nats_url").notNull(),
    /** Albion Online Data REST API with price history; private servers have none */
    apiUrl: text("api_url"),
    isPublic: boolean("is_public").notNull().default(true),
});

/** Market orders from NATS `marketorders.deduped.bulk` */
export const marketOrders = pgTable(
    "market_orders",
    {
        serverId: text("server_id")
            .notNull()
            .references(() => servers.id),
        orderId: bigint("order_id", { mode: "number" }).notNull(),
        /** Market id with the enchantment suffix, e.g. T4_HEAD_CLOTH_KEEPER@1 */
        itemId: text("item_id").notNull(),
        /** Market location as a 4 digit cluster index, e.g. 4002 */
        locationId: text("location_id").notNull(),
        qualityLevel: smallint("quality_level").notNull(),
        unitPriceSilver: bigint("unit_price_silver", { mode: "number" }).notNull(),
        amount: integer().notNull(),
        /** offer is a sell order, request is a buy order */
        auctionType: text("auction_type", { enum: ["offer", "request"] }).notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.serverId, table.orderId] }),
        index("market_orders_lookup_idx").on(
            table.serverId,
            table.itemId,
            table.locationId,
            table.qualityLevel,
        ),
        index("market_orders_expires_at_idx").on(table.expiresAt),
    ],
);

/** 30 day averages per item and city from the Albion Online Data charts API */
export const averagePrices = pgTable(
    "average_prices",
    {
        serverId: text("server_id")
            .notNull()
            .references(() => servers.id),
        itemId: text("item_id").notNull(),
        city: text().notNull(),
        /** Average sale price weighted by items sold */
        averagePrice: doublePrecision("average_price").notNull(),
        /** Items sold per day among the days with sales */
        averageItems: doublePrecision("average_items").notNull(),
        firstDate: timestamp("first_date", { withTimezone: true }),
        lastDate: timestamp("last_date", { withTimezone: true }),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    },
    (table) => [primaryKey({ columns: [table.serverId, table.itemId, table.city] })],
);

export type Server = typeof servers.$inferSelect;
export type AveragePrice = typeof averagePrices.$inferInsert;
export type MarketOrder = typeof marketOrders.$inferInsert;
