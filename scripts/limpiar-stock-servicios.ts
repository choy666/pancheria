import dotenv from 'dotenv';

// Mismo patrón que scripts/cargar-stock.ts: dotenv corre antes del primer
// uso de la base (el cliente se resuelve lazy en @/db). No pisa variables
// ya definidas en el entorno: para apuntar a otra base (p. ej. producción)
// exportar DATABASE_URL antes de invocar.
dotenv.config({ path: '.env.local' });

import { and, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import * as branchRepository from '@/repositories/branchRepository';
import { db } from '@/db';
import { executeInTransaction } from '@/application/transactionService';
import { products, stockMovements } from '@/db/schema';
import { nowUTC } from '@/lib/date';
import type { ProductRow } from '@/domain/types';

const SCRIPT_ACTOR = 'Script limpieza stock';
const CLEANUP_REASON = 'Corrección: los servicios y las promos no manejan stock';

/**
 * One-off: deja en 0 el `stock`/`min_stock` de productos `service` y
 * `compound`. Esos tipos no manejan stock (la disponibilidad del servicio es
 * infinita y la del compuesto sale de su receta), pero cargas históricas de
 * `scripts/cargar-stock.ts` les escribieron valores — hoy `adjustStock` los
 * rechaza.
 *
 * Por cada producto con `stock <> 0` se inserta un movimiento
 * `manual_adjustment` compensatorio (-stock) antes de poner la columna en 0,
 * así el ledger de `stock_movements` queda consistente (la suma de
 * movimientos coincide con el stock actual) sin reescribir la historia.
 * `min_stock` se resetea sin movimiento porque no audita stock.
 */

async function findDirtyProducts(branchId: number): Promise<ProductRow[]> {
  return db.query.products.findMany({
    where: and(
      eq(products.branchId, branchId),
      inArray(products.type, ['service', 'compound']),
      isNull(products.deletedAt),
      or(ne(products.stock, 0), ne(products.minStock, 0))
    ),
    orderBy: (products, { asc }) => [asc(products.name)],
  });
}

function printPlan(dirty: ProductRow[]): void {
  if (dirty.length === 0) {
    console.log('\nNo hay servicios ni promos con stock/min_stock residual.');
    return;
  }
  console.log(`\nProductos a corregir: ${dirty.length}`);
  for (const p of dirty) {
    const parts = [
      p.stock !== 0
        ? `stock ${p.stock} → 0 (movimiento ${-p.stock})`
        : null,
      p.minStock !== 0 ? `min_stock ${p.minStock} → 0` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    console.log(`  ↺ ${p.name} [${p.type}]: ${parts}`);
  }
}

async function applyPlan(branchId: number, dirty: ProductRow[]) {
  return executeInTransaction(async (tx) => {
    for (const p of dirty) {
      if (p.stock !== 0) {
        await tx.insert(stockMovements).values({
          branchId,
          productId: p.id,
          productName: p.name,
          type: 'manual_adjustment',
          quantity: -p.stock,
          reason: CLEANUP_REASON,
          performedBy: SCRIPT_ACTOR,
          createdAt: nowUTC(),
        });
      }
      await tx
        .update(products)
        .set({ stock: 0, minStock: 0 })
        .where(and(eq(products.id, p.id), eq(products.branchId, branchId)));
      console.log(`↺ ${p.name}: stock ${p.stock} → 0, min_stock ${p.minStock} → 0`);
    }
    return dirty.length;
  });
}

// ————————————————————————————————————————————————————————————————————
// CLI
// ————————————————————————————————————————————————————————————————————

function parseArgs(argv: string[]): {
  branch?: string;
  apply: boolean;
  help: boolean;
} {
  const parsed = { branch: undefined as string | undefined, apply: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      parsed.apply = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--branch') {
      parsed.branch = argv[++i];
    } else if (arg.startsWith('--branch=')) {
      parsed.branch = arg.slice('--branch='.length);
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  return parsed;
}

function printUsage(): void {
  console.log(`Limpia stock/min_stock residual de servicios y promos.

Uso:
  npx tsx scripts/limpiar-stock-servicios.ts --branch <id|nombre> [--apply]

  --branch   Sucursal destino por id numérico o nombre exacto.
             También puede definirse con la variable CARGA_BRANCH.
  --apply    Escribe en la base. Sin este flag solo imprime el plan (dry-run).

Por cada producto con stock residual inserta un movimiento
'manual_adjustment' compensatorio (actor "${SCRIPT_ACTOR}") y deja
stock/min_stock en 0. Todo corre en una única transacción.

Para apuntar a otra base exportar DATABASE_URL antes de invocar (dotenv
no pisa variables ya definidas); ver .devin/informes/entornos.md para
producción.`);
}

async function resolveBranch(ref: string) {
  const asId = Number(ref);
  if (Number.isInteger(asId) && asId > 0) {
    return branchRepository.findById(asId);
  }
  return branchRepository.findByNameCaseInsensitive(ref);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const branchRef = args.branch ?? process.env.CARGA_BRANCH;
  if (!branchRef) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const branch = await resolveBranch(branchRef);
  if (!branch) {
    console.error(`Sucursal no encontrada: "${branchRef}".`);
    process.exitCode = 1;
    return;
  }
  console.log(`Sucursal: ${branch.name} (id ${branch.id}) — ${args.apply ? 'APLICANDO' : 'dry-run'}`);

  const dirty = await findDirtyProducts(branch.id);
  printPlan(dirty);

  if (dirty.length === 0) return;
  if (!args.apply) {
    console.log('\nDry-run: nada escrito. Reejecutar con --apply para aplicar.');
    return;
  }

  const applied = await applyPlan(branch.id, dirty);
  console.log(`\nListo: ${applied} productos corregidos.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
