import dotenv from 'dotenv';

// Mismo patrón que scripts/cargar-catalogo.ts: dotenv antes del primer
// uso de la base. No pisa variables ya definidas: para producción exportar
// DATABASE_URL antes de invocar (ver .devin/informes/entornos.md).
dotenv.config({ path: '.env.local' });

import { eq, inArray, notExists } from 'drizzle-orm';
import { db } from '@/db';
import {
  products,
  recipes,
  saleItemRecipes,
  saleItems,
  sales,
} from '@/db/schema';
import { executeInTransaction } from '@/application/transactionService';

/**
 * Backfill de `sale_item_recipes` para ítems de venta de productos
 * `compound` vendidos antes de que existiera el snapshot de receta
 * (migración 0034). Es el finding `compound_sale_item_missing_snapshot`
 * de `sanityAuditService`.
 *
 * La reconstrucción usa la RECETA VIGENTE del producto, que pudo haber
 * cambiado desde la venta: aproxima una venta "por defecto" —
 *   selected = !isOptional || selectedByDefault
 * (los críticos y los fixeds siempre van; los opcionales quedan según su
 * default). Es la mejor aproximación disponible: sin snapshot no hay
 * registro de qué eligió el cliente. Si la venta se anula después, el
 * reintegro reproduce esa composición.
 *
 * Ítems cuyo producto ya no tiene receta vigente se omiten con advertencia
 * (no hay fuente para reconstruir).
 *
 * Dry-run por defecto; `--apply` escribe en una única transacción.
 */

type PlanEntry = {
  saleItemId: number;
  saleId: number;
  saleCreatedAt: Date;
  branchId: number;
  productName: string;
  rows: (typeof saleItemRecipes.$inferInsert)[];
};

type Plan = {
  entries: PlanEntry[];
  skipped: { saleItemId: number; productName: string; reason: string }[];
};

async function buildPlan(): Promise<Plan> {
  const items = await db
    .select({
      saleItemId: saleItems.id,
      saleId: saleItems.saleId,
      productId: saleItems.productId,
      branchId: sales.branchId,
      saleCreatedAt: sales.createdAt,
      productName: products.name,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(
      notExists(
        db
          .select({ id: saleItemRecipes.id })
          .from(saleItemRecipes)
          .where(eq(saleItemRecipes.saleItemId, saleItems.id))
      )
    );

  const compoundIds = [...new Set(items.map((i) => i.productId))];
  const compoundRows = compoundIds.length
    ? await db
        .select({ id: products.id, type: products.type })
        .from(products)
        .where(inArray(products.id, compoundIds))
    : [];
  const typeById = new Map(compoundRows.map((p) => [p.id, p.type]));

  const recipeRows = compoundIds.length
    ? await db
        .select({
          compoundId: recipes.compoundProductId,
          supplyId: recipes.supplyId,
          supplyName: products.name,
          supplyType: products.type,
          quantity: recipes.quantity,
          autoDiscount: recipes.autoDiscount,
          isOptional: recipes.isOptional,
          selectedByDefault: recipes.selectedByDefault,
        })
        .from(recipes)
        .innerJoin(products, eq(products.id, recipes.supplyId))
        .where(inArray(recipes.compoundProductId, compoundIds))
    : [];
  const recipeByCompound = new Map<number, typeof recipeRows>();
  for (const row of recipeRows) {
    const list = recipeByCompound.get(row.compoundId) ?? [];
    list.push(row);
    recipeByCompound.set(row.compoundId, list);
  }

  const entries: PlanEntry[] = [];
  const skipped: Plan['skipped'] = [];

  for (const item of items) {
    if (typeById.get(item.productId) !== 'compound') {
      continue;
    }
    const recipe = recipeByCompound.get(item.productId) ?? [];
    if (recipe.length === 0) {
      skipped.push({
        saleItemId: item.saleItemId,
        productName: item.productName,
        reason: 'el producto ya no tiene receta vigente',
      });
      continue;
    }
    entries.push({
      saleItemId: item.saleItemId,
      saleId: item.saleId,
      saleCreatedAt: item.saleCreatedAt,
      branchId: item.branchId,
      productName: item.productName,
      rows: recipe.map((r) => ({
        saleItemId: item.saleItemId,
        supplyId: r.supplyId,
        supplyName: r.supplyName,
        supplyType: r.supplyType,
        quantity: r.quantity,
        autoDiscount: r.autoDiscount,
        isOptional: r.isOptional,
        selected: !r.isOptional || r.selectedByDefault,
        selectedByDefault: r.selectedByDefault,
      })),
    });
  }

  return { entries, skipped };
}

function printPlan(plan: Plan): void {
  console.log(`\nÍtems de venta compuestos sin snapshot: ${plan.entries.length + plan.skipped.length}`);
  for (const entry of plan.entries) {
    console.log(
      `  sale_item ${entry.saleItemId} — venta ${entry.saleId} (${entry.saleCreatedAt.toISOString()}) ` +
        `branch ${entry.branchId} — "${entry.productName}" → ${entry.rows.length} filas`
    );
  }
  for (const skip of plan.skipped) {
    console.warn(
      `  ⚠ sale_item ${skip.saleItemId} — "${skip.productName}": ${skip.reason}`
    );
  }
  if (plan.entries.length === 0) {
    console.log('  (nada que reconstruir)');
  }
}

async function applyPlan(plan: Plan) {
  return executeInTransaction(async (tx) => {
    const rows = plan.entries.flatMap((e) => e.rows);
    if (rows.length > 0) {
      await tx.insert(saleItemRecipes).values(rows);
    }
    return rows.length;
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`Reconstruye sale_item_recipes de ventas compuestas legacy.

Uso:
  npx tsx scripts/backfill-sale-item-recipes.ts [--apply]

  --apply   Inserta las filas faltantes. Sin el flag solo imprime el plan.

Usa la receta VIGENTE como aproximación (ver comentario del archivo).
Para producción exportar DATABASE_URL antes de invocar; ver
.devin/informes/entornos.md.`);
    return;
  }

  console.log(apply ? 'Modo: APLICANDO' : 'Modo: dry-run');
  const plan = await buildPlan();
  printPlan(plan);

  if (!apply) {
    console.log('\nDry-run: nada escrito. Reejecutar con --apply para aplicar.');
    return;
  }
  if (plan.entries.length === 0) return;

  const inserted = await applyPlan(plan);
  console.log(`\nListo: ${inserted} filas insertadas en sale_item_recipes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
