CREATE TYPE "public"."delivery_type" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'converted', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."stock_movement_type" ADD VALUE 'order';--> statement-breakpoint
ALTER TYPE "public"."stock_movement_type" ADD VALUE 'order_cancellation';--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"order_number" varchar(255) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"delivery_type" "delivery_type" NOT NULL,
	"address" text,
	"notes" text,
	"cancellation_token" varchar(255) NOT NULL,
	"converted_sale_id" integer,
	"idempotency_key" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "order_id" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_converted_sale_id_sales_id_fk" FOREIGN KEY ("converted_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_branch_id_idx" ON "orders" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_branch_status_deleted_at_idx" ON "orders" USING btree ("branch_id","status","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_unique_idx" ON "orders" USING btree ("branch_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_branch_unique_idx" ON "orders" USING btree ("branch_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements" USING btree ("order_id");