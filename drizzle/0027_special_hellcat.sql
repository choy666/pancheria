ALTER TABLE "branches" DROP CONSTRAINT "branches_name_unique";--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'public_order_rate_limits'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "public_order_rate_limits" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "public_order_rate_limits" ADD CONSTRAINT "public_order_rate_limits_scope_ip_pk" PRIMARY KEY("scope","ip");--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "public_order_rate_limits" ADD COLUMN "scope" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "order_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "branches_deleted_at_idx" ON "branches" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_name_active_unique_idx" ON "branches" USING btree ("name") WHERE "branches"."deleted_at" is null;