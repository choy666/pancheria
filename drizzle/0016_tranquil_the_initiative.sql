ALTER TABLE "orders" ADD COLUMN "customer_phone" varchar(50) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "customer_phone" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "orders_customer_phone_idx" ON "orders" USING btree ("customer_phone");
