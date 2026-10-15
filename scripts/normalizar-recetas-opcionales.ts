import dotenv from 'dotenv';

// Mismo patrón que scripts/cargar-stock.ts: dotenv corre antes del primer
// uso de la base (el cliente se resuelve lazy en @/db). No pisa variables
// ya definidas en el entorno: para apuntar a otra base (p. ej. producción)
// exportar DATABASE_URL antes de invocar.
dotenv.config({ path: '.env.local' });

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { executeInTransaction } from '@/application/transactionService';
import { products, recipes } from '@/db/schema';

/**
 * Normaliza los flags `is_optional` / `selected_by_default` / `auto_discount`
 * de `recipes` contra el tipo del insumo, alineándolos con las reglas que
 * `recipeSchema` (POST /api/recetas) ya exige:
 *
 * - `critical_supply` → is_optional=false, selected_by_default=false,
 *   auto_discount=true (estructurales, descuentan stock siempre).
 * - `manual_supply` / `service` / `compound` → is_optional=true (el cliente
 *   siempre puede quitarlos). `selected_by_default` se fuerza a true cuando
 *   la fila venía con is_optional=false: antes estaban incluidos siempre, y
 *   preseleccionados conservan ese comportamiento visible en /pedido.
 *
 * Filas válidas no se tocan. Todo corre en una única transacción.
 */

type RecipeRow = {
  recipeId: number;
  compoundProductId: number;
  promoName: string;
  supplyName: string;
  supplyType: string;
  isOptional: boolean;
  selectedByDefault: boolean;
  autoDiscount: boolean;
};

type Fix = {
  row: RecipeRow;
  isOptional: boolean;
  selectedByDefault: boolean;
  autoDiscount: boolean;
  reason: string;
};

async function loadRows(): Promise<RecipeRow[]> {
  const rows = await db
    .select({
      recipeId: recipes.id,
      compoundProductId: recipes.compoundProductId,
      supplyName: products.name,
      supplyType: products.type,
      isOptional: recipes.isOptional,
      selectedByDefault: recipes.selectedByDefault,
      autoDiscount: recipes.autoDiscount,
    })
    .from(recipes)
    .innerJoin(products, eq(recipes.supplyId, products.id));

  const promoNames = await db
    .select({ id: products.id, name: products.name })
    .from(products);
  const promoNameById = new Map(promoNames.map((p) => [p.id, p.name]));

  return rows.map((row) => ({
    ...row,
    promoName:
      promoNameById.get(row.compoundProductId) ??
      `#${row.compoundProductId}`,
  }));
}

function planFixes(rows: RecipeRow[]): Fix[] {
  const fixes: Fix[] = [];

  for (const row of rows) {
    if (row.supplyType === 'critical_supply') {
      if (row.isOptional || row.selectedByDefault || !row.autoDiscount) {
        fixes.push({
          row,
          isOptional: false,
          selectedByDefault: false,
          autoDiscount: true,
          reason: 'insumo crítico con flags de opcional',
        });
      }
      continue;
    }

    if (!row.isOptional || row.autoDiscount) {
      fixes.push({
        row,
        isOptional: true,
        // La fila no opcional estaba incluida siempre: preseleccionado
        // conserva ese comportamiento visible en /pedido.
        selectedByDefault: row.isOptional ? row.selectedByDefault : true,
        autoDiscount: false,
        reason: !row.isOptional
          ? 'no crítico marcado como no opcional (400 al guardar)'
          : 'no crítico con descuento automático (400 al guardar)',
      });
      continue;
    }
  }

  return fixes;
}

function printPlan(fixes: Fix[]): void {
  if (fixes.length === 0) {
    console.log('\nTodas las recetas ya respetan las reglas. Nada que hacer.');
    return;
  }

  const byPromo = new Map<number, { name: string; fixes: Fix[] }>();
  for (const fix of fixes) {
    const entry = byPromo.get(fix.row.compoundProductId) ?? {
      name: fix.row.promoName,
      fixes: [],
    };
    entry.fixes.push(fix);
    byPromo.set(fix.row.compoundProductId, entry);
  }

  console.log(`\nFilas a normalizar: ${fixes.length} (en ${byPromo.size} promos)`);
  for (const [promoId, entry] of byPromo) {
    console.log(`\n  Promo ${promoId} — ${entry.name}`);
    for (const fix of entry.fixes) {
      const before = `opt=${fix.row.isOptional} def=${fix.row.selectedByDefault} auto=${fix.row.autoDiscount}`;
      const after = `opt=${fix.isOptional} def=${fix.selectedByDefault} auto=${fix.autoDiscount}`;
      console.log(
        `    ↑ ${fix.row.supplyName} (${fix.row.supplyType}): ${before} → ${after} — ${fix.reason}`
      );
    }
  }
}

async function applyFixes(fixes: Fix[]): Promise<number> {
  return executeInTransaction(async (tx) => {
    for (const fix of fixes) {
      await tx
        .update(recipes)
        .set({
          isOptional: fix.isOptional,
          selectedByDefault: fix.selectedByDefault,
          autoDiscount: fix.autoDiscount,
        })
        .where(eq(recipes.id, fix.row.recipeId));
    }
    return fixes.length;
  });
}

// ————————————————————————————————————————————————————————————————————
// CLI
// ————————————————————————————————————————————————————————————————————

function parseArgs(argv: string[]): { apply: boolean; help: boolean } {
  const parsed = { apply: false, help: false };
  for (const arg of argv) {
    if (arg === '--apply') {
      parsed.apply = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return parsed;
}

function printUsage(): void {
  console.log(`Normaliza flags de opcionales en recetas contra el tipo del insumo.

Uso:
  npx tsx scripts/normalizar-recetas-opcionales.ts [--apply]

  --apply    Escribe en la base. Sin este flag solo imprime el plan (dry-run).

Corrige filas que POST /api/recetas rechaza con 400 (p. ej. un service o
manual_supply con is_optional=false) y filas de críticos con flags sucios.
Es global: afecta todas las sucursales. Para apuntar a otra base exportar
DATABASE_URL antes de invocar (dotenv no pisa variables ya definidas); ver
.devin/informes/entornos.md para producción.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const rows = await loadRows();
  const fixes = planFixes(rows);

  console.log(`Recetas auditadas: ${rows.length} filas — ${args.apply ? 'APLICANDO' : 'dry-run'}`);
  printPlan(fixes);

  if (fixes.length === 0 || !args.apply) {
    if (fixes.length > 0) {
      console.log('\nDry-run: nada escrito. Reejecutar con --apply para aplicar.');
    }
    return;
  }

  const applied = await applyFixes(fixes);
  console.log(`\nListo: ${applied} filas normalizadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
