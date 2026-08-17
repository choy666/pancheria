import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from './index';
import { products, recipes } from './schema';
import * as stockService from '@/application/services/stockService';

export async function copyCatalogToBranch(
  sourceBranchId: number,
  targetBranchId: number
) {
  const sourceProducts = await db.query.products.findMany({
    where: and(eq(products.branchId, sourceBranchId), isNull(products.deletedAt)),
  });

  if (sourceProducts.length === 0) {
    console.log('La sucursal origen no tiene productos para copiar.');
    return;
  }

  const existingTargetProducts = await db.query.products.findMany({
    columns: { id: true },
    where: eq(products.branchId, targetBranchId),
    limit: 1,
  });

  if (existingTargetProducts.length > 0) {
    console.log('La sucursal destino ya tiene productos. Se omite la copia del catálogo.');
    return;
  }

  const productValues = sourceProducts.map((p) => ({
    branchId: targetBranchId,
    name: p.name,
    description: p.description,
    type: p.type,
    criticalSupplyType: p.criticalSupplyType,
    price: p.price,
    unit: p.unit,
    stock: 0,
    minStock: p.minStock,
    isActive: p.isActive,
  }));

  const insertedProducts = await db
    .insert(products)
    .values(productValues)
    .returning({ id: products.id, name: products.name });

  const oldToNewProductId = new Map<number, number>();
  for (const source of sourceProducts) {
    const target = insertedProducts.find((p) => p.name === source.name);
    if (target) {
      oldToNewProductId.set(source.id, target.id);
    }
  }

  const sourceProductIds = sourceProducts.map((p) => p.id);
  const sourceRecipes = await db.query.recipes.findMany({
    where: inArray(recipes.compoundProductId, sourceProductIds),
  });

  const recipeValues = sourceRecipes
    .map((r) => {
      const compoundProductId = oldToNewProductId.get(r.compoundProductId);
      const supplyId = oldToNewProductId.get(r.supplyId);
      if (!compoundProductId || !supplyId) return null;
      return {
        compoundProductId,
        supplyId,
        quantity: r.quantity,
        autoDiscount: r.autoDiscount,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (recipeValues.length > 0) {
    await db.insert(recipes).values(recipeValues);
  }

  for (const source of sourceProducts) {
    const targetId = oldToNewProductId.get(source.id);
    if (!targetId || source.stock <= 0) continue;
    await stockService.adjustStock(
      targetBranchId,
      targetId,
      source.stock,
      'Stock inicial por copia de catálogo',
      'restock'
    );
  }

  console.log('Catálogo copiado a la sucursal opcional.');
}
