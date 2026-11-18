CREATE TABLE "server_order_activity" (
	"server_id" text NOT NULL,
	"minute" timestamp with time zone NOT NULL,
	"orders" integer NOT NULL,
	CONSTRAINT "server_order_activity_server_id_minute_pk" PRIMARY KEY("server_id","minute")
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "ingest_connected" boolean;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "ingest_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "server_order_activity" ADD CONSTRAINT "server_order_activity_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;