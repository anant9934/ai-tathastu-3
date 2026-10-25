CREATE TYPE "public"."user_role" AS ENUM('student', 'faculty', 'alumni');--> statement-breakpoint
ALTER TABLE "onboarding_state" ALTER COLUMN "current_step" SET DEFAULT 'role';--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD COLUMN "research_interests" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD COLUMN "expertise_areas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD COLUMN "mentorship" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD COLUMN "give_back" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'student' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "academic_title" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "graduation_year" integer;