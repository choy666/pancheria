ALTER TABLE "orders" ADD COLUMN "idempotency_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "idempotency_hash" varchar(64);