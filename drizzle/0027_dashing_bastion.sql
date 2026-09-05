/*
    La PK anterior de "public_order_rate_limits" se creó inline en
    drizzle/0010_harsh_lizard.sql (`"ip" varchar(255) PRIMARY KEY`), por lo que
    Postgres le asignó el nombre por defecto "public_order_rate_limits_pkey".
    Si la base destino usa otro nombre, verificarlo con:

        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_schema = 'public'
            AND table_name = 'public_order_rate_limits'
            AND constraint_type = 'PRIMARY KEY';
*/

-- Las filas preexistentes eran todas del rate limit de pedidos; se backfillean
-- con 'order' para poder crear la PK compuesta sin perder datos.
ALTER TABLE "public_order_rate_limits" ADD COLUMN "scope" varchar(64) DEFAULT 'order';--> statement-breakpoint
ALTER TABLE "public_order_rate_limits" ALTER COLUMN "scope" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "public_order_rate_limits" ALTER COLUMN "scope" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "public_order_rate_limits" DROP CONSTRAINT "public_order_rate_limits_pkey";--> statement-breakpoint
ALTER TABLE "public_order_rate_limits" ADD CONSTRAINT "public_order_rate_limits_scope_ip_pk" PRIMARY KEY("scope","ip");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "order_id" integer;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
