CREATE TABLE "widget_prefs" (
	"user_id" uuid NOT NULL,
	"widget_id" text NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"order_override" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widget_prefs_user_id_widget_id_pk" PRIMARY KEY("user_id","widget_id")
);
--> statement-breakpoint
ALTER TABLE "widget_prefs" ADD CONSTRAINT "widget_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;