import dotenv from 'dotenv';

// Mismo patrón que src/db/seeds.ts: dotenv corre antes del primer uso de la
// base (el cliente se resuelve lazy en @/db).
dotenv.config({ path: '.env.local' });

import { pathToFileURL } from 'url';
import * as branchRepository from '@/repositories/branchRepository';
import * as productService from '@/application/services/productService';
import * as recipeService from '@/application/services/recipeService';
import * as stockService from '@/application/services/stockService';
import { executeInTransaction } from '@/application/transactionService';
import type { RecipeItemInsert } from '@/repositories/recipeRepository';
import {
  PRODUCTOS,
  RECETAS,
  buildCatalogPlan,
  normalizeName,
  type CatalogPlan,
} from './data/catalogo-pancheria-popular';

const SCRIPT_ACTOR = 'Script carga catálogo';
const STOCK_REASON = 'Carga inicial de catálogo';

// ————————————————————————————————————————————————————————————————————
// Impresión del plan (dry-run y resumen post-apply)
// ————————————————————————————————————————————————————————————————————

function printPlan(plan: CatalogPlan): void {
  console.log(`\nProductos a crear: ${plan.creates.length}`);
  for (const def of plan.creates) {
    const extras = [
      def.maxOptionalSelections != null
        ? `tope opcionales ${def.maxOptionalSelections}`
        : null,
      (def.isActive ?? true) === false ? 'INACTIVO (precio pendiente)' : null,
      (def.initialStock ?? 0) > 0 ? `stock inicial ${def.initialStock}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    console.log(
      `  + ${def.name} [${def.type}${def.criticalSupplyType ? `/${def.criticalSupplyType}` : ''}] $${def.price} x ${def.unit}${extras ? ` — ${extras}` : ''}`
    );
  }

  if (plan.skips.length > 0) {
    console.log(`\nProductos omitidos (ya existen): ${plan.skips.length}`);
    for (const { def, existing, diffs } of plan.skips) {
      console.log(
        `  = ${def.name} (id ${existing.id})${diffs.length > 0 ? ` — difiere: ${diffs.join('; ')}` : ''}`
      );
    }
  }

  console.log(`\nRecetas a (re)guardar: ${plan.recipes.length}`);
  for (const { def, compoundExisted } of plan.recipes) {
    const fixeds = (def.fixeds ?? []).length;
    console.log(
      `  ~ ${def.compound}: ${def.criticals.length} críticos + ${def.optionals.length} opcionales${fixeds > 0 ? ` + ${fixeds} fijos` : ''}${compoundExisted ? ' (compuesto existente)' : ''}`
    );
  }

  if (plan.stockActions.length > 0) {
    console.log(`\nStock inicial (restock, solo productos nuevos):`);
    for (const action of plan.stockActions) {
      console.log(`  ↑ ${action.productName}: +${action.quantity}`);
    }
  }

  for (const warning of plan.warnings) {
    console.warn(`\n⚠ ${warning}`);
  }
  for (const error of plan.errors) {
    console.error(`\n✗ ${error}`);
  }
}

// ————————————————————————————————————————————————————————————————————
// Aplicación
// ————————————————————————————————————————————————————————————————————

async function applyPlan(branchId: number, plan: CatalogPlan) {
  return executeInTransaction(async (tx) => {
    const idByName = new Map<string, number>();

    for (const { existing } of plan.skips) {
      idByName.set(normalizeName(existing.name), existing.id);
    }

    for (const def of plan.creates) {
      const created = await productService.createProduct(branchId, {
        name: def.name,
        description: def.description ?? null,
        type: def.type,
        criticalSupplyType: def.criticalSupplyType ?? null,
        price: def.price,
        unit: def.unit,
        stock: 0,
        minStock: def.minStock ?? 0,
        maxOptionalSelections: def.maxOptionalSelections ?? null,
        isActive: def.isActive ?? true,
      });
      if (!created) {
        throw new Error(`No se pudo crear el producto ${def.name}.`);
      }
      idByName.set(normalizeName(def.name), created.id);
      console.log(`+ ${def.name} (id ${created.id})`);
    }

    for (const action of plan.stockActions) {
      const productId = idByName.get(normalizeName(action.productName));
      if (!productId) {
        throw new Error(
          `Stock inicial sin producto resuelto: ${action.productName}.`
        );
      }
      await stockService.adjustStock(
        branchId,
        productId,
        action.quantity,
        STOCK_REASON,
        'restock',
        SCRIPT_ACTOR,
        tx
      );
      console.log(`↑ Stock ${action.productName}: +${action.quantity}`);
    }

    for (const { def } of plan.recipes) {
      const compoundId = idByName.get(normalizeName(def.compound));
      if (!compoundId) {
        throw new Error(`Receta sin compuesto resuelto: ${def.compound}.`);
      }
      const items: RecipeItemInsert[] = [
        ...def.criticals.map((item) => ({
          supplyId: idByName.get(normalizeName(item.supply))!,
          quantity: item.quantity,
          autoDiscount: true,
          isOptional: false,
          selectedByDefault: false,
        })),
        // Componentes incluidos sin elección (vaso de gaseosa de promo):
        // siempre seleccionados, no cuentan al tope ni bloquean stock.
        ...(def.fixeds ?? []).map((item) => ({
          supplyId: idByName.get(normalizeName(item.supply))!,
          quantity: item.quantity,
          autoDiscount: false,
          isOptional: false,
          selectedByDefault: false,
        })),
        ...def.optionals.map((item) => ({
          supplyId: idByName.get(normalizeName(item.supply))!,
          quantity: item.quantity,
          autoDiscount: false,
          isOptional: true,
          selectedByDefault: item.selectedByDefault,
        })),
      ];
      await recipeService.saveRecipe(branchId, compoundId, items);
      console.log(`~ Receta guardada: ${def.compound} (${items.length} ítems)`);
    }

    return idByName.size;
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
  console.log(`Carga el catálogo de Panchería Popular en una sucursal.

Uso:
  npx tsx scripts/cargar-catalogo.ts --branch <id|nombre> [--apply]

  --branch   Sucursal destino por id numérico o nombre exacto.
             También puede definirse con la variable CARGA_BRANCH.
  --apply    Escribe en la base. Sin este flag solo imprime el plan (dry-run).

El script es idempotente: los productos existentes por nombre se omiten,
las recetas se reescriben y el stock inicial solo aplica a productos nuevos.
Todo corre en una única transacción.`);
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
    process.exit(0);
  }

  const branchRef = args.branch ?? process.env.CARGA_BRANCH;
  if (!branchRef) {
    console.error('Falta la sucursal destino: usá --branch <id|nombre> o la variable CARGA_BRANCH.');
    process.exit(1);
  }

  const branch = await resolveBranch(branchRef);
  if (!branch) {
    console.error(`No se encontró la sucursal "${branchRef}".`);
    process.exit(1);
  }
  console.log(`Sucursal: ${branch.name} (id ${branch.id})`);

  const existing = await productService.listProducts(branch.id);
  const plan = buildCatalogPlan(existing, PRODUCTOS, RECETAS);

  printPlan(plan);

  if (plan.errors.length > 0) {
    console.error('\nEl plan tiene errores: no se escribió nada.');
    process.exit(1);
  }

  if (!args.apply) {
    console.log('\nDry-run: no se escribió nada. Re-ejecutar con --apply para aplicar.');
    process.exit(0);
  }

  const total = await applyPlan(branch.id, plan);
  console.log(`\nListo: ${total} productos disponibles en la sucursal.`);

  const pending = plan.warnings.filter((w) => w.includes('INACTIVOS'));
  if (pending.length > 0) {
    console.warn(
      '\nRecordatorio: hay productos inactivos por precio pendiente. Fijar precio y activarlos desde /productos.'
    );
  }
  console.log(
    'Nota: las escrituras directas no invalidan el caché del catálogo público. Esperar DATA_CACHE_REVALIDATE_S o hacer redeploy antes de verificar /pedido.'
  );
  process.exit(0);
}

const isMain =
  process.argv.length > 1 &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error('Error al cargar el catálogo:', error);
    process.exit(1);
  });
}
