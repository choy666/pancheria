ALTER TABLE "products" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_mime_type" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_size" integer;