import { executeInTransaction } from '@/application/transactionService';
import * as recipeRepository from '@/repositories/recipeRepository';
import * as productRepository from '@/repositories/productRepository';
import { NotFoundError, ValidationError } from '@/domain/errors';
import { validateBranchOwnership } from '@/lib/validation-helpers';
import type { RecipeItemInsert } from '@/repositories/recipeRepository';

export async function getRecipeByProductId(branchId: number, productId: number) {
  const product = await productRepository.findById(branchId, productId);
  if (!product || product.type !== 'compound') {
    throw new NotFoundError('Producto compuesto', productId);
  }

  return recipeRepository.findByCompoundProductId(branchId, productId);
}

export async function saveRecipe(
  branchId: number,
  compoundProductId: number,
  items: RecipeItemInsert[]
) {
  const product = await productRepository.findById(branchId, compoundProductId);
  if (!product || product.type !== 'compound') {
    throw new ValidationError('El producto debe ser de tipo compuesto.');
  }

  validateBranchOwnership(product, branchId, 'Producto compuesto');

  const criticalItems = items.filter((item) => item.autoDiscount);
  if (criticalItems.length === 0) {
    throw new ValidationError(
      'La receta debe incluir al menos un insumo crítico con descuento automático.'
    );
  }

  const uniqueSupplyIds = new Set(items.map((item) => item.supplyId));

  if (uniqueSupplyIds.has(compoundProductId)) {
    throw new ValidationError(
      'Una receta no puede incluir al propio producto compuesto como insumo.'
    );
  }

  if (uniqueSupplyIds.size !== items.length) {
    throw new ValidationError('No puede haber insumos duplicados en la receta.');
  }

  // Si el producto tiene tope de opcionales, los preseleccionados deben
  // entrar en ese tope: de lo contrario el diálogo nacería en un estado que
  // el servidor mismo rechaza.
  if (product.maxOptionalSelections != null) {
    const defaultCount = items.filter(
      (item) =>
        (item.isOptional ?? !item.autoDiscount) && item.selectedByDefault
    ).length;
    if (defaultCount > product.maxOptionalSelections) {
      throw new ValidationError(
        `La receta tiene ${defaultCount} insumos preseleccionados pero el producto permite elegir hasta ${product.maxOptionalSelections}.`
      );
    }
  }

  const supplyIds = items.map((item) => item.supplyId);
  const supplies = await productRepository.findByIds(branchId, supplyIds);

  if (supplies.length !== supplyIds.length) {
    throw new ValidationError('Uno o más insumos de la receta no existen.');
  }

  for (const item of items) {
    const supply = supplies.find((s) => s.id === item.supplyId);
    if (!supply) {
      throw new ValidationError(`Insumo con ID ${item.supplyId} no encontrado.`);
    }

    validateBranchOwnership(supply, branchId, 'Insumo');

    if (supply.deletedAt) {
      throw new ValidationError(
        `El insumo ${supply.name} está eliminado y no puede usarse en recetas.`
      );
    }

    // Los flags se re-deriven contra el tipo real del insumo: el cliente no
    // puede mentir `supplyType` ni mandar combinaciones que el schema solo
    // detecta si el cliente declaró el tipo correcto.
    if (supply.type === 'critical_supply') {
      if (!item.autoDiscount) {
        throw new ValidationError(
          `El insumo crítico ${supply.name} debe tener descuento automático.`
        );
      }
      if (item.isOptional) {
        throw new ValidationError(
          `El insumo crítico ${supply.name} no puede ser opcional.`
        );
      }
      if (item.selectedByDefault) {
        throw new ValidationError(
          `El insumo crítico ${supply.name} no puede estar preseleccionado.`
        );
      }
    } else {
      if (item.autoDiscount) {
        throw new ValidationError(
          `El insumo ${supply.name} no es crítico y no puede tener descuento automático.`
        );
      }
      if (item.isOptional === false) {
        throw new ValidationError(
          `El insumo ${supply.name} no es crítico y debe ser opcional.`
        );
      }
    }
  }

  return executeInTransaction(async (tx) => {
    await recipeRepository.deleteByCompoundProductId(tx, compoundProductId);

    const values = items.map((item) => ({
      compoundProductId,
      supplyId: item.supplyId,
      quantity: item.quantity,
      autoDiscount: item.autoDiscount,
      isOptional:
        item.isOptional ?? (item.autoDiscount ? false : true),
      selectedByDefault: item.selectedByDefault ?? false,
    }));

    return recipeRepository.insertMany(tx, values);
  });
}
