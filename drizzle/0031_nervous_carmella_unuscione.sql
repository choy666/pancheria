CREATE INDEX "order_item_recipes_supply_id_idx" ON "order_item_recipes" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_converted_sale_id_idx" ON "orders" USING btree ("converted_sale_id");--> statement-breakpoint
CREATE INDEX "products_image_key_idx" ON "products" USING btree ("image_key");--> statement-breakpoint
CREATE INDEX "recipes_supply_id_idx" ON "recipes" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "sale_item_recipes_supply_id_idx" ON "sale_item_recipes" USING btree ("supply_id");--> statement-breakpoint
CREATE INDEX "sale_items_product_id_idx" ON "sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_sale_id_idx" ON "stock_movements" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "stock_movements_order_id_idx" ON "stock_movements" USING btree ("order_id");