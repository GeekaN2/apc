CREATE TABLE "average_prices" (
	"server_id" text NOT NULL,
	"item_id" text NOT NULL,
	"city" text NOT NULL,
	"average_price" double precision NOT NULL,
	"average_items" double precision NOT NULL,
	"first_date" timestamp with time zone,
	"last_date" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "average_prices_server_id_item_id_city_pk" PRIMARY KEY("server_id","item_id","city")
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "api_url" text;--> statement-breakpoint
ALTER TABLE "average_prices" ADD CONSTRAINT "average_prices_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE no action ON UPDATE no action;