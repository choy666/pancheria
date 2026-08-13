ALTER TABLE "cash_registers" DROP CONSTRAINT "cash_registers_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "daily_closures" DROP CONSTRAINT "daily_closures_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_compound_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "recipes" DROP CONSTRAINT "recipes_supply_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_sale_id_sales_id_fk";
--> statement-breakpoint
ALTER TABLE "sale_items" DROP CONSTRAINT "sale_items_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "sales" DROP CONSTRAINT "sales_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "sales" DROP CONSTRAINT "sales_cash_register_id_cash_registers_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_sale_id_sales_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_branch_id_branches_id_fk";
--> statement-breakpoint
ALTER TABLE "cash_registers" ALTER COLUMN "products_summary" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "cash_registers" ALTER COLUMN "products_summary" SET DATA TYPE jsonb USING "products_summary"::jsonb;--> statement-breakpoint
ALTER TABLE "cash_registers" ALTER COLUMN "products_summary" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "cash_registers" ALTER COLUMN "critical_supplies_summary" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "cash_registers" ALTER COLUMN "critical_supplies_summary" SET DATA TYPE jsonb USING "critical_supplies_summary"::jsonb;--> statement-breakpoint
ALTER TABLE "cash_registers" ALTER COLUMN "critical_supplies_summary" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "daily_closures" ALTER COLUMN "products_summary" SET DATA TYPE jsonb USING "products_summary"::jsonb;--> statement-breakpoint
ALTER TABLE "daily_closures" ALTER COLUMN "critical_supplies_summary" SET DATA TYPE jsonb USING "critical_supplies_summary"::jsonb;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_compound_product_id_products_id_fk" FOREIGN KEY ("compound_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_supply_id_products_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_register_id_cash_registers_id_fk" FOREIGN KEY ("cash_register_id") REFERENCES "public"."cash_registers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;