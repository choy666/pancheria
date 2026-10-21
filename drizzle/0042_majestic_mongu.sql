CREATE TYPE "public"."menu_card_style" AS ENUM('image', 'compact');--> statement-breakpoint
CREATE TYPE "public"."menu_font_scale" AS ENUM('normal', 'large');--> statement-breakpoint
CREATE TYPE "public"."menu_sort_order" AS ENUM('catalog', 'price_asc', 'price_desc');--> statement-breakpoint
ALTER TABLE "menu_settings" ADD COLUMN "grid_columns" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_settings" ADD COLUMN "font_scale" "menu_font_scale" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_settings" ADD COLUMN "show_descriptions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_settings" ADD COLUMN "card_style" "menu_card_style" DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_settings" ADD COLUMN "sort_order" "menu_sort_order" DEFAULT 'catalog' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_settings" ADD COLUMN "featured_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_settings" ADD COLUMN "qr_strip_text" text DEFAULT 'Pedí desde tu celu' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_settings" ADD CONSTRAINT "menu_settings_grid_columns_check" CHECK ("menu_settings"."grid_columns" between 3 and 5);