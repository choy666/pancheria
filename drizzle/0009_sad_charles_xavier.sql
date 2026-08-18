ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."stock_movement_type";--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('sale', 'cancellation', 'manual_adjustment', 'restock');--> statement-breakpoint
ALTER TABLE "stock_movements" ALTER COLUMN "type" SET DATA TYPE "public"."stock_movement_type" USING "type"::"public"."stock_movement_type";--> statement-breakpoint
DROP INDEX "stock_movements_order_id_idx";--> statement-breakpoint
ALTER TABLE "stock_movements" DROP COLUMN "order_id";