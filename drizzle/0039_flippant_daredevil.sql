ALTER TABLE "order_item_recipes" DROP CONSTRAINT "order_item_recipes_supply_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "sale_item_recipes" DROP CONSTRAINT "sale_item_recipes_supply_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "order_item_recipes" ALTER COLUMN "supply_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_item_recipes" ALTER COLUMN "supply_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
-- Snapshots del producto en el registro histórico: se agregan nullable,
-- se rellenan desde `products` y recién ahí pasan a NOT NULL. Los FKs
-- anteriores eran `restrict`, así que toda fila existente tiene producto
-- y el backfill cubre el 100% de los casos.
ALTER TABLE "order_items" ADD COLUMN "product_name" varchar(255);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "product_type" "product_type";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "critical_supply_type" "critical_supply_type";--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "product_name" varchar(255);--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "product_type" "product_type";--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "critical_supply_type" "critical_supply_type";--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "product_name" varchar(255);--> statement-breakpoint
UPDATE "sale_items" si
	SET "product_name" = p."name",
		"product_type" = p."type",
		"critical_supply_type" = p."critical_supply_type"
	FROM "products" p
	WHERE p."id" = si."product_id";--> statement-breakpoint
UPDATE "order_items" oi
	SET "product_name" = p."name",
		"product_type" = p."type",
		"critical_supply_type" = p."critical_supply_type"
	FROM "products" p
	WHERE p."id" = oi."product_id";--> statement-breakpoint
UPDATE "stock_movements" sm
	SET "product_name" = p."name"
	FROM "products" p
	WHERE p."id" = sm."product_id";--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "product_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ALTER COLUMN "product_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ALTER COLUMN "product_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "product_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item_recipes" ADD CONSTRAINT "order_item_recipes_supply_id_products_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_item_recipes" ADD CONSTRAINT "sale_item_recipes_supply_id_products_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
