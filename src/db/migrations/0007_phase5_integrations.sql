CREATE TABLE "integration_auth_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"code_challenge" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_consents" (
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"scopes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"hidden_projects" text[] DEFAULT '{}'::text[] NOT NULL,
	"linked_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_consents_user_id_client_id_pk" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "integration_auth_codes" ADD CONSTRAINT "integration_auth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_consents" ADD CONSTRAINT "integration_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_outbox" ADD CONSTRAINT "webhook_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_outbox_pending_key" ON "webhook_outbox" USING btree ("client_id","user_id","event") WHERE "webhook_outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "webhook_outbox_due_idx" ON "webhook_outbox" USING btree ("next_attempt_at") WHERE "webhook_outbox"."status" IN ('pending', 'sending');