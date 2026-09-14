ALTER TABLE "branches" ADD COLUMN "phones" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "social_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Backfill: el teléfono histórico pasa a ser el primer contacto con etiqueta
-- "Principal". Las sucursales sin teléfono quedan con el default [].
UPDATE "branches"
SET "phones" = jsonb_build_array(
	jsonb_build_object('label', 'Principal', 'number', btrim("phone"))
)
WHERE "phone" IS NOT NULL AND btrim("phone") <> '';--> statement-breakpoint
ALTER TABLE "branches" DROP COLUMN "phone";
