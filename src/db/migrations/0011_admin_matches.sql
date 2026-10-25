CREATE TABLE "matches" (
	"student_id" uuid NOT NULL,
	"mentor_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"score" real NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_student_id_mentor_id_pk" PRIMARY KEY("student_id","mentor_id")
);
--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "institutions" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_mentor_idx" ON "matches" USING btree ("mentor_id","score");--> statement-breakpoint
ALTER TABLE "institutions" ADD CONSTRAINT "institutions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;