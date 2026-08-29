ALTER TABLE "cash_registers" ADD COLUMN "initial_amount" numeric(10, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_registers" ADD COLUMN "closing_cash_count" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "cash_registers" ADD COLUMN "closing_difference" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "cash_registers" ADD COLUMN "closing_notes" text;