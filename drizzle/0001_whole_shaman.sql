ALTER TABLE "cash_registers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "cash_registers_deleted_at_idx" ON "cash_registers" USING btree ("deleted_at");