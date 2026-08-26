CREATE INDEX "order_messages_attachment_key_idx" ON "order_messages" USING btree ("attachment_key");--> statement-breakpoint
CREATE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_customer_name_idx" ON "orders" USING btree ("customer_name");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_cancellation_token_unique_idx" ON "orders" USING btree ("cancellation_token");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_check" CHECK ("products"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_min_stock_check" CHECK ("products"."min_stock" >= 0);