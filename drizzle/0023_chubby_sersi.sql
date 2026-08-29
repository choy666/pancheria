CREATE TABLE "order_item_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_item_id" integer NOT NULL,
	"supply_id" integer NOT NULL,
	"supply_name" varchar(255) NOT NULL,
	"supply_type" "product_type" NOT NULL,
	"quantity" integer NOT NULL,
	"auto_discount" boolean NOT NULL,
	"is_optional" boolean NOT NULL,
	"selected" boolean NOT NULL,
	"selected_by_default" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_item_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_item_id" integer NOT NULL,
	"supply_id" integer NOT NULL,
	"supply_name" varchar(255) NOT NULL,
	"supply_type" "product_type" NOT NULL,
	"quantity" integer NOT NULL,
	"auto_discount" boolean NOT NULL,
	"is_optional" boolean NOT NULL,
	"selected" boolean NOT NULL,
	"selected_by_default" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_registers" ADD COLUMN "recipe_supplies_summary" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_closures" ADD COLUMN "recipe_supplies_summary" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "selected_by_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item_recipes" ADD CONSTRAINT "order_item_recipes_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_recipes" ADD CONSTRAINT "order_item_recipes_supply_id_products_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_recipes" ADD CONSTRAINT "sale_item_recipes_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_recipes" ADD CONSTRAINT "sale_item_recipes_supply_id_products_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_item_recipes_order_item_id_idx" ON "order_item_recipes" USING btree ("order_item_id");--> statement-breakpoint
CREATE INDEX "sale_item_recipes_sale_item_id_idx" ON "sale_item_recipes" USING btree ("sale_item_id");