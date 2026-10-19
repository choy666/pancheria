CREATE TYPE "public"."pantalla_item_kind" AS ENUM('product', 'video');--> statement-breakpoint
CREATE TYPE "public"."pantalla_playlist_mode" AS ENUM('auto', 'custom');--> statement-breakpoint
CREATE TABLE "pantalla_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"kind" "pantalla_item_kind" NOT NULL,
	"product_id" integer,
	"video_id" integer,
	"position" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pantalla_items_position_check" CHECK ("pantalla_items"."position" >= 0),
	CONSTRAINT "pantalla_items_ref_check" CHECK ((("pantalla_items"."kind" = 'product' AND "pantalla_items"."product_id" IS NOT NULL AND "pantalla_items"."video_id" IS NULL) OR ("pantalla_items"."kind" = 'video' AND "pantalla_items"."video_id" IS NOT NULL AND "pantalla_items"."product_id" IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "pantalla_settings" (
	"branch_id" integer PRIMARY KEY NOT NULL,
	"playlist_mode" "pantalla_playlist_mode" DEFAULT 'auto' NOT NULL,
	"producto_ms" integer DEFAULT 6000 NOT NULL,
	"sucursal_ms" integer DEFAULT 8000 NOT NULL,
	"qr_ms" integer DEFAULT 12000 NOT NULL,
	"video_max_ms" integer DEFAULT 120000 NOT NULL,
	"max_productos" integer DEFAULT 15 NOT NULL,
	"show_branch_scene" boolean DEFAULT true NOT NULL,
	"show_qr_scene" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pantalla_settings_producto_ms_check" CHECK ("pantalla_settings"."producto_ms" >= 1000),
	CONSTRAINT "pantalla_settings_sucursal_ms_check" CHECK ("pantalla_settings"."sucursal_ms" >= 1000),
	CONSTRAINT "pantalla_settings_qr_ms_check" CHECK ("pantalla_settings"."qr_ms" >= 1000),
	CONSTRAINT "pantalla_settings_video_max_ms_check" CHECK ("pantalla_settings"."video_max_ms" >= 1000),
	CONSTRAINT "pantalla_settings_max_productos_check" CHECK ("pantalla_settings"."max_productos" >= 1)
);
--> statement-breakpoint
ALTER TABLE "pantalla_items" ADD CONSTRAINT "pantalla_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantalla_items" ADD CONSTRAINT "pantalla_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantalla_items" ADD CONSTRAINT "pantalla_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pantalla_settings" ADD CONSTRAINT "pantalla_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pantalla_items_branch_position_idx" ON "pantalla_items" USING btree ("branch_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "pantalla_items_branch_product_uniq" ON "pantalla_items" USING btree ("branch_id","product_id") WHERE "pantalla_items"."product_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pantalla_items_branch_video_uniq" ON "pantalla_items" USING btree ("branch_id","video_id") WHERE "pantalla_items"."video_id" IS NOT NULL;