CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"state" text,
	"country_code" text
);
--> statement-breakpoint
CREATE TABLE "degrees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"level" text NOT NULL,
	"duration_years" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "degrees_canonical_name_unique" UNIQUE("canonical_name")
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"institution_type" text DEFAULT 'other' NOT NULL,
	"city" text,
	"state" text,
	"country_code" text,
	"website" text,
	"verification_status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "specializations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"applicable_degree_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "specializations_canonical_name_unique" UNIQUE("canonical_name")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "institution_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "campus_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "degree_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "specialization_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_academic_year" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "expected_graduation_year" integer;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_event_idx" ON "analytics_events" USING btree ("event","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_verified_name_key" ON "institutions" USING btree (lower("canonical_name")) WHERE "institutions"."verification_status" = 'verified';--> statement-breakpoint
CREATE INDEX "institutions_created_by_idx" ON "institutions" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "public"."campuses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_degree_id_degrees_id_fk" FOREIGN KEY ("degree_id") REFERENCES "public"."degrees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_specialization_id_specializations_id_fk" FOREIGN KEY ("specialization_id") REFERENCES "public"."specializations"("id") ON DELETE set null ON UPDATE no action;