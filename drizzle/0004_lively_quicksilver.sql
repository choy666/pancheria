CREATE TYPE "public"."user_role" AS ENUM('admin', 'operator');

CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "branches_name_unique" UNIQUE("name")
);

-- Agregar columnas branch_id como nullable para poder poblar datos existentes
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'operator' NOT NULL;
ALTER TABLE "users" ADD COLUMN "branch_id" integer;
ALTER TABLE "products" ADD COLUMN "branch_id" integer;
ALTER TABLE "cash_registers" ADD COLUMN "branch_id" integer;
ALTER TABLE "sales" ADD COLUMN "branch_id" integer;
ALTER TABLE "stock_movements" ADD COLUMN "branch_id" integer;
ALTER TABLE "daily_closures" ADD COLUMN "branch_id" integer;

-- Crear sucursal por defecto y vincularla a los datos existentes
DO $$
DECLARE
	default_branch_id integer;
BEGIN
	INSERT INTO "branches" ("name")
	VALUES (COALESCE(current_setting('DEFAULT_BRANCH_NAME', true), 'Sucursal por defecto'))
	ON CONFLICT ("name") DO NOTHING
	RETURNING "id" INTO default_branch_id;

	IF default_branch_id IS NULL THEN
		SELECT "id" INTO default_branch_id FROM "branches" WHERE "name" = COALESCE(current_setting('DEFAULT_BRANCH_NAME', true), 'Sucursal por defecto');
	END IF;

	UPDATE "users" SET "branch_id" = default_branch_id WHERE "branch_id" IS NULL;
	UPDATE "products" SET "branch_id" = default_branch_id WHERE "branch_id" IS NULL;
	UPDATE "cash_registers" SET "branch_id" = default_branch_id WHERE "branch_id" IS NULL;
	UPDATE "sales" SET "branch_id" = default_branch_id WHERE "branch_id" IS NULL;
	UPDATE "stock_movements" SET "branch_id" = default_branch_id WHERE "branch_id" IS NULL;
	UPDATE "daily_closures" SET "branch_id" = default_branch_id WHERE "branch_id" IS NULL;
END $$;

-- Hacer las columnas branch_id NOT NULL y agregar foreign keys
ALTER TABLE "users" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "products" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "cash_registers" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "sales" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "stock_movements" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "daily_closures" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "daily_closures" ADD CONSTRAINT "daily_closures_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;

-- Actualizar restricciones e índices
ALTER TABLE "daily_closures" DROP CONSTRAINT "daily_closures_date_unique";
DROP INDEX "cash_registers_status_deleted_at_idx";
DROP INDEX "products_type_idx";
DROP INDEX "products_active_deleted_idx";
DROP INDEX "products_type_is_active_idx";
DROP INDEX "cash_registers_open_status_idx";
ALTER TABLE "sales" DROP CONSTRAINT "sales_idempotency_key_unique";

CREATE INDEX "users_branch_id_idx" ON "users" USING btree ("branch_id");
CREATE INDEX "products_branch_id_idx" ON "products" USING btree ("branch_id");
CREATE INDEX "products_branch_active_deleted_idx" ON "products" USING btree ("branch_id","is_active","deleted_at");
CREATE INDEX "products_branch_type_is_active_idx" ON "products" USING btree ("branch_id","type","is_active","deleted_at");
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");
CREATE INDEX "cash_registers_branch_id_idx" ON "cash_registers" USING btree ("branch_id");
CREATE INDEX "cash_registers_branch_status_deleted_at_idx" ON "cash_registers" USING btree ("branch_id","status","deleted_at");
CREATE UNIQUE INDEX "cash_registers_open_status_idx" ON "cash_registers" USING btree ("branch_id","status") WHERE "cash_registers"."status" = 'open' AND "cash_registers"."deleted_at" IS NULL;
CREATE INDEX "sales_branch_id_idx" ON "sales" USING btree ("branch_id");
CREATE INDEX "sales_branch_created_at_idx" ON "sales" USING btree ("branch_id","created_at");
CREATE UNIQUE INDEX "sales_idempotency_branch_unique_idx" ON "sales" USING btree ("branch_id","idempotency_key");
CREATE INDEX "stock_movements_branch_id_idx" ON "stock_movements" USING btree ("branch_id");
CREATE INDEX "stock_movements_branch_product_created_at_idx" ON "stock_movements" USING btree ("branch_id","product_id","created_at");
CREATE UNIQUE INDEX "daily_closures_branch_date_unique_idx" ON "daily_closures" USING btree ("branch_id","date");
CREATE INDEX "daily_closures_branch_date_idx" ON "daily_closures" USING btree ("branch_id","date");
