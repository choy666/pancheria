CREATE TABLE "order_stock_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"branch_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'in_process';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'paid';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'finished';--> statement-breakpoint
UPDATE "orders" SET "status" = 'paid' WHERE "status" = 'converted';--> statement-breakpoint
ALTER TABLE "order_stock_reservations" ADD CONSTRAINT "order_stock_reservations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_reservations" ADD CONSTRAINT "order_stock_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_stock_reservations" ADD CONSTRAINT "order_stock_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_stock_reservations_order_id_idx" ON "order_stock_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_stock_reservations_product_id_idx" ON "order_stock_reservations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_stock_reservations_branch_product_idx" ON "order_stock_reservations" USING btree ("branch_id","product_id");
