CREATE TABLE "market_orders" (
	"server_id" text NOT NULL,
	"order_id" bigint NOT NULL,
	"item_id" text NOT NULL,
	"location_id" text NOT NULL,
	"quality_level" smallint NOT NULL,
	"unit_price_silver" bigint NOT NULL,
	"amount" integer NOT NULL,
	"auction_type" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "market_orders_server_id_order_id_pk" PRIMARY KEY("server_id","order_id")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nats_url" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_orders_lookup_idx" ON "market_orders" USING btree ("server_id","item_id","location_id","quality_level");--> statement-breakpoint
CREATE INDEX "market_orders_expires_at_idx" ON "market_orders" USING btree ("expires_at");