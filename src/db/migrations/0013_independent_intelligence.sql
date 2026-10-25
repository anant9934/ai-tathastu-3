CREATE TABLE "collaboration_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"embedding" jsonb NOT NULL,
	"profile_summary" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaboration_embeddings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "github_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"repo_name" text,
	"impact_score" integer NOT NULL,
	"rationale" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"current_stage" text NOT NULL,
	"short_term" jsonb NOT NULL,
	"mid_term" jsonb NOT NULL,
	"long_term" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmaps_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "collaboration_embeddings" ADD CONSTRAINT "collaboration_embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_scores" ADD CONSTRAINT "github_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "collaboration_embeddings_user_idx" ON "collaboration_embeddings" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "github_scores_user_idx" ON "github_scores" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "github_scores_user_repo_idx" ON "github_scores" USING btree ("user_id","repo_id");
--> statement-breakpoint
CREATE INDEX "roadmaps_user_idx" ON "roadmaps" USING btree ("user_id");
