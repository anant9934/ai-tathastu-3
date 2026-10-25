CREATE TABLE "auth_accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "auth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"granted" boolean,
	"policy_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"current_step" text DEFAULT 'career_direction' NOT NULL,
	"career_role" text,
	"career_role_other" text,
	"career_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priorities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resume_uploaded" boolean DEFAULT false NOT NULL,
	"connectors_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"consents_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"field_group" text NOT NULL,
	"field_name" text NOT NULL,
	"record_key" text,
	"extracted_value" jsonb,
	"normalized_value" jsonb,
	"source_evidence" text,
	"location" jsonb,
	"extraction_method" text,
	"origin" text NOT NULL,
	"confidence" real,
	"validation_status" text,
	"confirmation" text DEFAULT 'unconfirmed' NOT NULL,
	"snapshot_id" uuid,
	"superseded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"email_verified" timestamp with time zone,
	"name" text,
	"avatar_url" text,
	"university" text,
	"degree" text,
	"specialization" text,
	"academic_year" text,
	"city" text,
	"country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_facts" ADD CONSTRAINT "profile_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consents_user_purpose_idx" ON "consents" USING btree ("user_id","purpose","created_at");--> statement-breakpoint
CREATE INDEX "profile_facts_current_idx" ON "profile_facts" USING btree ("user_id","field_group","field_name") WHERE "profile_facts"."superseded_by" IS NULL;--> statement-breakpoint
CREATE INDEX "profile_facts_conflicting_idx" ON "profile_facts" USING btree ("user_id") WHERE "profile_facts"."validation_status" = 'conflicting';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));