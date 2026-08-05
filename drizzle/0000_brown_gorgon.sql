CREATE TYPE "public"."cash_register_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."critical_supply_type" AS ENUM('bread', 'sausage', 'beverage');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('critical_supply', 'compound', 'manual_supply');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('sale', 'cancellation', 'manual_adjustment', 'restock');--> statement-breakpoint
CREATE TABLE "cash_registers" (
	"id" serial PRIMARY KEY NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opened_by" varchar(255) NOT NULL,
	"closed_by" varchar(255),
	"status" "cash_register_status" DEFAULT 'open' NOT NULL,
	"auto_closed" boolean DEFAULT false NOT NULL,
	"total" numeric(10, 2) DEFAULT 0 NOT NULL,
	"cash_total" numeric(10, 2) DEFAULT 0 NOT NULL,
	"transfer_total" numeric(10, 2) DEFAULT 0 NOT NULL,
	"total_sales" integer DEFAULT 0 NOT NULL,
	"products_summary" text DEFAULT '{}' NOT NULL,
	"critical_supplies_summary" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_closures" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"cash_total" numeric(10, 2) NOT NULL,
	"transfer_total" numeric(10, 2) NOT NULL,
	"total_sales" integer NOT NULL,
	"products_summary" text NOT NULL,
	"critical_supplies_summary" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_closures_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "product_type" NOT NULL,
	"critical_supply_type" "critical_supply_type",
	"price" numeric(10, 2) NOT NULL,
	"unit" varchar(50) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"compound_product_id" integer NOT NULL,
	"supply_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"auto_discount" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "sale_status" DEFAULT 'active' NOT NULL,
	"cash_register_id" integer,
	"idempotency_key" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	CONSTRAINT "sales_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"sale_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_compound_product_id_products_id_fk" FOREIGN KEY ("compound_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_supply_id_products_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_register_id_cash_registers_id_fk" FOREIGN KEY ("cash_register_id") REFERENCES "public"."cash_registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_registers_status_idx" ON "cash_registers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cash_registers_opened_at_idx" ON "cash_registers" USING btree ("opened_at");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("type");--> statement-breakpoint
CREATE INDEX "products_active_deleted_idx" ON "products" USING btree ("is_active","deleted_at");--> statement-breakpoint
CREATE INDEX "recipes_compound_product_idx" ON "recipes" USING btree ("compound_product_id");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sales_cash_register_created_at_idx" ON "sales" USING btree ("cash_register_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_product_created_at_idx" ON "stock_movements" USING btree ("product_id","created_at");