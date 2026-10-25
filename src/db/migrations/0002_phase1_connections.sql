CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"access_method" text NOT NULL,
	"token_enc" "bytea",
	"status" text DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"stale_after" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connections_user_source_key" ON "connections" USING btree ("user_id","source_id");