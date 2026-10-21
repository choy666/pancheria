CREATE TABLE "menu_settings" (
	"branch_id" integer PRIMARY KEY NOT NULL,
	"pagina_ms" integer DEFAULT 12000 NOT NULL,
	"filas_pagina" integer DEFAULT 4 NOT NULL,
	"show_qr_strip" boolean DEFAULT true NOT NULL,
	"hidden_product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menu_settings_pagina_ms_check" CHECK ("menu_settings"."pagina_ms" >= 1000),
	CONSTRAINT "menu_settings_filas_pagina_check" CHECK ("menu_settings"."filas_pagina" >= 1)
);
--> statement-breakpoint
ALTER TABLE "menu_settings" ADD CONSTRAINT "menu_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;