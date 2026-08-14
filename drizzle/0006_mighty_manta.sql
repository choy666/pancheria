CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"file_url" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "videos_branch_id_idx" ON "videos" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "videos_branch_active_deleted_idx" ON "videos" USING btree ("branch_id","is_active","deleted_at");