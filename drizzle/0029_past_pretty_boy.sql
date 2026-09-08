ALTER TABLE "cash_registers" ADD COLUMN "forced_closed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD COLUMN "forced_close_reason" text;