CREATE TABLE "code_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"repo_name" text NOT NULL,
	"description" text,
	"url" text,
	"languages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"topics" text[] DEFAULT '{}'::text[] NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"last_commit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eris_scores" (
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"score" real NOT NULL,
	"breakdown_json" jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eris_scores_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "profile_views" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"view" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_aliases" (
	"alias" text PRIMARY KEY NOT NULL,
	"skill_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"fact_id" uuid,
	"source" text NOT NULL,
	"evidence_strength" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	CONSTRAINT "skills_canonical_name_unique" UNIQUE("canonical_name")
);
--> statement-breakpoint
CREATE TABLE "unified_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"canonical_title" text NOT NULL,
	"source_fact_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"match_confidence" real DEFAULT 0 NOT NULL,
	"technologies" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'standalone' NOT NULL,
	"timeline_start" date,
	"timeline_end" date,
	"conflict_present" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "code_repositories" ADD CONSTRAINT "code_repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eris_scores" ADD CONSTRAINT "eris_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_views" ADD CONSTRAINT "profile_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_evidence" ADD CONSTRAINT "skill_evidence_fact_id_profile_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."profile_facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_projects" ADD CONSTRAINT "unified_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "code_repositories_user_source_repo_key" ON "code_repositories" USING btree ("user_id","source","repo_name");--> statement-breakpoint
CREATE INDEX "skill_evidence_user_skill_idx" ON "skill_evidence" USING btree ("user_id","skill_id");--> statement-breakpoint
CREATE INDEX "unified_projects_user_idx" ON "unified_projects" USING btree ("user_id");