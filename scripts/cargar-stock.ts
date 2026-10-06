import dotenv from 'dotenv';

// Mismo patrón que scripts/cargar-catalogo.ts y src/db/seeds.ts: dotenv
// corre antes del primer uso de la base (el cliente se resuelve lazy en
// @/db). No pisa variables ya definidas en el entorno: para apuntar a otra
// base (p. ej. producción) exportar DATABASE_URL antes de invocar.
dotenv.config({ path: '.env.local' });

import { and, eq } from 'drizzle-orm';
import * as branchRepository from '@/repositories/branchRepository';
import * as productRepository from '@/repositories/productRepository';
import * as stockService from '@/application/services/stockService';
import { executeInTransaction } from '@/application/transactionService';
import { products } from '@/db/schema';
import { STOCK_INICIAL, type StockInicialEntry } from './data/stock-inicial';

const SCRIPT_ACTOR = 'Script carga stock';
const STOCK_REASON = 'Carga inicial de stock';

type PlanAction = {
  entry: StockInicialEntry;
  productId: number;
  currentMinStock: number;
};

type Plan = {
  actions: PlanAction[];
  pendings: StockInicialEntry[];
  errors: string[];
};

async function buildPlan(branchId: number): Promise<Plan> {
  const actions: PlanAction[] = [];
  const pendings: StockInicialEntry[] = [];
  const errors: string[] = [];

  for (const entry of STOCK_INICIAL) {
    const product = await productRepository.findByNameCaseInsensitive(
      branchId,
      entry.product
    );
    if (!product) {
      errors.push(`Producto no encontrado en la sucursal: "${entry.product}".`);
      continue;
    }
    const wantsStock = entry.quantity > 0;
    const wantsMinStock =
      entry.minStock !== undefined && entry.minStock !== product.minStock;
    if (!wantsStock && !wantsMinStock) {
      pendings.push(entry);
      continue;
    }
    if (entry.quantity < 0) {
      errors.push(`Cantidad negativa para "${entry.product}" (${entry.quantity}).`);
      continue;
    }
    actions.push({ entry, productId: product.id, currentMinStock: product.minStock });
  }

  return { actions, pendings, errors };
}

function printPlan(plan: Plan): void {
  if (plan.actions.length > 0) {
    console.log(`\nAcciones a aplicar: ${plan.actions.length}`);
    for (const { entry, currentMinStock } of plan.actions) {
      const parts = [
        entry.quantity > 0 ? `+${entry.quantity} (restock)` : null,
        entry.minStock !== undefined && entry.minStock !== currentMinStock
          ? `min_stock ${currentMinStock} → ${entry.minStock}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
      console.log(`  ↑ ${entry.product}: ${parts}`);
    }
  }
  if (plan.pendings.length > 0) {
    console.log(`\nPendientes sin cantidad/min_stock nuevo (omitidos): ${plan.pendings.length}`);
    for (const entry of plan.pendings) {
      console.log(`  … ${entry.product}`);
    }
  }
  for (const error of plan.errors) {
    console.error(`\n✗ ${error}`);
  }
}

async function applyPlan(branchId: number, plan: Plan) {
  return executeInTransaction(async (tx) => {
    for (const { entry, productId, currentMinStock } of plan.actions) {
      if (entry.quantity > 0) {
        await stockService.adjustStock(
          branchId,
          productId,
          entry.quantity,
          STOCK_REASON,
          'restock',
          SCRIPT_ACTOR,
          tx
        );
        console.log(`↑ Stock ${entry.product}: +${entry.quantity}`);
      }
      if (entry.minStock !== undefined && entry.minStock !== currentMinStock) {
        await tx
          .update(products)
          .set({ minStock: entry.minStock })
          .where(and(eq(products.id, productId), eq(products.branchId, branchId)));
        console.log(`  min_stock ${entry.product}: ${currentMinStock} → ${entry.minStock}`);
      }
    }
    return plan.actions.length;
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
  console.log(`Carga stock y min_stock en una sucursal ya provisionada.

Uso:
  npx tsx scripts/cargar-stock.ts --branch <id|nombre> [--apply]

  --branch   Sucursal destino por id numérico o nombre exacto.
             También puede definirse con la variable CARGA_BRANCH.
  --apply    Escribe en la base. Sin este flag solo imprime el plan (dry-run).

Los datos salen de scripts/data/stock-inicial.ts: quantity 0 = pendiente
(la entrada se omite). El stock se carga como movimientos 'restock' con
actor "${SCRIPT_ACTOR}". Todo corre en una única transacción.

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

  const plan = await buildPlan(branch.id);
  printPlan(plan);

  if (plan.errors.length > 0) {
    console.error('\nHay errores en el plan: corregir los datos antes de aplicar.');
    process.exitCode = 1;
    return;
  }
  if (!args.apply) {
    console.log('\nDry-run: nada escrito. Reejecutar con --apply para aplicar.');
    return;
  }

  const applied = await applyPlan(branch.id, plan);
  console.log(`\nListo: ${applied} productos actualizados.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
