import {
  listProducts,
  getProductById,
  listActiveProducts,
  listActiveProductsWithAvailability,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  permanentlyDeleteProduct,
} from './productService';
import * as productRepository from '@/repositories/productRepository';
import type { ProductInsert, ProductUpdate } from '@/repositories/productRepository';
import * as recipeRepository from '@/repositories/recipeRepository';
import * as saleService from '@/application/services/saleService';
import * as productImageStorage from '@/lib/product-image-storage';
import { db } from '@/db';
import { recipes } from '@/db/schema';
import { ValidationError, NotFoundError } from '@/domain/errors';
import type { ProductRow } from '@/domain/types';

jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/recipeRepository');
jest.mock('@/application/services/saleService');
jest.mock('@/lib/product-image-storage');
jest.mock('@/application/transactionService', () => ({
  executeInTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(db)
  ),
}));
jest.mock('@/db', () => ({
  db: {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(undefined),
    query: {
      recipes: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      saleItems: { findFirst: jest.fn() },
      orderItems: { findFirst: jest.fn() },
      saleItemRecipes: { findFirst: jest.fn() },
      orderItemRecipes: { findFirst: jest.fn() },
      orderStockReservations: { findFirst: jest.fn() },
      stockMovements: { findFirst: jest.fn() },
    },
  },
}));

const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedRecipeRepository = recipeRepository as jest.Mocked<
  typeof recipeRepository
>;
const mockedSaleService = saleService as jest.Mocked<typeof saleService>;
const mockedProductImageStorage = productImageStorage as jest.Mocked<
  typeof productImageStorage
>;
const mockedDb = db as unknown as {
  delete: jest.Mock;
  where: jest.Mock;
  query: {
    recipes: { findMany: jest.Mock; findFirst: jest.Mock };
    saleItems: { findFirst: jest.Mock };
    orderItems: { findFirst: jest.Mock };
    saleItemRecipes: { findFirst: jest.Mock };
    orderItemRecipes: { findFirst: jest.Mock };
    orderStockReservations: { findFirst: jest.Mock };
    stockMovements: { findFirst: jest.Mock };
  };
};

const BRANCH_ID = 1;

describe('productService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeEach(() => {
    mockedProductRepository.findByIdForUpdate.mockImplementation(
      async (branchId: number, id: number, includeDeleted = false) =>
        mockedProductRepository.findById(branchId, id, includeDeleted)
    );
  });

  describe('listProducts', () => {
    test('lista productos activos por defecto', async () => {
      mockedProductRepository.findAll.mockResolvedValue([
        { id: 1, name: 'Pan' },
        { id: 2, name: 'Gaseosa' },
      ] as ProductRow[]);

      const result = await listProducts(BRANCH_ID);

      expect(result).toHaveLength(2);
      expect(mockedProductRepository.findAll).toHaveBeenCalledWith(BRANCH_ID, false);
    });

    test('puede incluir productos eliminados', async () => {
      mockedProductRepository.findAll.mockResolvedValue([
        { id: 1, name: 'Pan', deletedAt: null },
        { id: 2, name: 'Pan viejo', deletedAt: new Date() },
      ] as ProductRow[]);

      const result = await listProducts(BRANCH_ID, true);

      expect(result).toHaveLength(2);
      expect(mockedProductRepository.findAll).toHaveBeenCalledWith(BRANCH_ID, true);
    });
  });

  describe('getProductById', () => {
    test('obtiene un producto por su ID', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Pan',
      } as ProductRow);

      const result = await getProductById(BRANCH_ID, 1);

      expect(result!.id).toBe(1);
      expect(mockedProductRepository.findById).toHaveBeenCalledWith(BRANCH_ID, 1, false);
    });

    test('lanza NotFoundError si el producto no existe', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(getProductById(BRANCH_ID, 999)).rejects.toThrow(NotFoundError);
      await expect(getProductById(BRANCH_ID, 999)).rejects.toThrow(
        'Producto con ID 999 no encontrado.'
      );
    });
  });

  describe('listActiveProducts', () => {
    test('lista los productos activos', async () => {
      mockedProductRepository.findActive.mockResolvedValue([
        { id: 1, name: 'Pan', isActive: true },
      ] as ProductRow[]);

      const result = await listActiveProducts(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pan');
      expect(mockedProductRepository.findActive).toHaveBeenCalledWith(BRANCH_ID);
    });
  });

  describe('listActiveProductsWithAvailability', () => {
    test('devuelve productos activos con su disponibilidad calculada', async () => {
      mockedProductRepository.findActive.mockResolvedValue([
        { id: 1, name: 'Panchuque', type: 'compound' },
        { id: 2, name: 'Pritty', type: 'critical_supply', criticalSupplyType: 'beverage' },
        { id: 3, name: 'Aderezo', type: 'service' },
      ] as ProductRow[]);

      mockedSaleService.calculateAvailabilityForProductIds.mockResolvedValue({
        1: { availability: 4, breakdown: [] },
        2: { availability: 12, breakdown: [] },
        3: { availability: Number.MAX_SAFE_INTEGER, breakdown: [] },
      });

      const result = await listActiveProductsWithAvailability(BRANCH_ID);

      expect(result).toHaveLength(3);
      expect(result[0].availability).toBe(4);
      expect(result[1].availability).toBe(12);
      expect(result[2].availability).toBe(Number.MAX_SAFE_INTEGER);
      expect(mockedProductRepository.findActive).toHaveBeenCalledWith(BRANCH_ID);
      expect(mockedSaleService.calculateAvailabilityForProductIds).toHaveBeenCalledWith(BRANCH_ID, [1, 2, 3]);
    });
  });

  describe('createProduct', () => {
    test('rechaza insumo crítico sin tipo crítico', async () => {
      await expect(
        createProduct(BRANCH_ID, {
          name: 'Pan',
          type: 'critical_supply',
          price: 100,
          unit: 'unidad',
        } as ProductRow)
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza tipo no crítico con tipo crítico', async () => {
      await expect(
        createProduct(BRANCH_ID, {
          name: 'Producto',
          type: 'manual_supply',
          criticalSupplyType: 'bread',
          price: 0,
          unit: 'unidad',
        } as unknown as ProductInsert)
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza insumo manual con precio', async () => {
      await expect(
        createProduct(BRANCH_ID, {
          name: 'Aderezo',
          type: 'manual_supply',
          price: 150,
          unit: 'unidad',
        } as unknown as ProductInsert)
      ).rejects.toThrow('Los insumos manuales no pueden tener precio.');
    });

    test('crea un producto con stock 0 y conserva el minStock indicado', async () => {
      const data = {
        name: 'Ketchup',
        type: 'manual_supply',
        price: 0,
        unit: 'unidad',
        stock: 10,
        minStock: 5,
      } as unknown as ProductInsert;

      mockedProductRepository.create.mockImplementation((created: ProductInsert & { branchId: number }) =>
        Promise.resolve({ id: 1, ...created } as ProductRow)
      );

      const result = await createProduct(BRANCH_ID, data);
      expect(result!.id).toBe(1);
      expect(result!.stock).toBe(0);
      expect(result!.minStock).toBe(5);
      expect(mockedProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ stock: 0, minStock: 5, branchId: BRANCH_ID })
      );
    });

    test('crea un insumo crítico con tipo válido', async () => {
      const data = {
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        price: 100,
        unit: 'unidad',
        stock: 20,
        minStock: 10,
      } as unknown as ProductInsert;

      mockedProductRepository.create.mockImplementation((created: ProductInsert & { branchId: number }) =>
        Promise.resolve({ id: 1, ...created } as ProductRow)
      );

      const result = await createProduct(BRANCH_ID, data);
      expect(result!.id).toBe(1);
      expect(result!.criticalSupplyType).toBe('bread');
      expect(result!.stock).toBe(0);
      expect(result!.minStock).toBe(10);
    });

    test('crea un producto compuesto y fuerza stock y minStock a 0', async () => {
      const data = {
        name: 'Panchuque',
        type: 'compound',
        price: 1500,
        unit: 'unidad',
        stock: 10,
        minStock: 5,
      } as unknown as ProductInsert;

      mockedProductRepository.create.mockResolvedValue({ id: 1, ...data, branchId: BRANCH_ID } as ProductRow);

      const result = await createProduct(BRANCH_ID, data);
      expect(result!.id).toBe(1);
      expect(result!.type).toBe('compound');
      expect(mockedProductRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ stock: 0, minStock: 0, branchId: BRANCH_ID })
      );
    });

    test('crea un servicio sin tipo crítico', async () => {
      const data = {
        name: 'Vaso de gaseosa',
        type: 'service',
        price: 500,
        unit: 'unidad',
        stock: 5,
        minStock: 2,
      } as unknown as ProductInsert;

      mockedProductRepository.create.mockImplementation((created: ProductInsert & { branchId: number }) =>
        Promise.resolve({ id: 1, ...created } as ProductRow)
      );

      const result = await createProduct(BRANCH_ID, data);
      expect(result!.id).toBe(1);
      expect(result!.type).toBe('service');
      expect(result!.stock).toBe(0);
      expect(result!.minStock).toBe(0);
    });
  });

  describe('updateProduct', () => {
    test('rechaza cambio de tipo si el producto es usado en una receta activa', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'critical_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      mockedDb.query.recipes.findMany.mockResolvedValue([
        { compoundProduct: { deletedAt: null } },
      ]);

      await expect(
        updateProduct(BRANCH_ID, 1, {
          type: 'manual_supply',
          price: 0,
        } as ProductRow)
      ).rejects.toThrow(ValidationError);
    });

    test('permite cambiar el tipo si el producto solo se usa en recetas de promos eliminadas', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'critical_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      mockedDb.query.recipes.findMany.mockResolvedValue([
        { compoundProduct: { deletedAt: new Date() } },
      ]);

      const data = { type: 'manual_supply', price: 0 } as unknown as ProductInsert;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      const result = await updateProduct(BRANCH_ID, 1, data);

      expect(result!.type).toBe('manual_supply');
      expect(mockedProductRepository.update).toHaveBeenCalledWith(BRANCH_ID, 1, data);
    });

    test('actualiza un producto válido y descarta stock pero conserva minStock', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      mockedDb.query.recipes.findMany.mockResolvedValue([]);

      const data = {
        name: 'Nuevo nombre',
        price: 0,
        stock: 50,
        minStock: 10,
      } as unknown as ProductInsert;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      const result = await updateProduct(BRANCH_ID, 1, data);
      expect(result!.name).toBe('Nuevo nombre');
      expect(mockedProductRepository.update).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        expect.not.objectContaining({ stock: expect.any(Number) })
      );
      expect(mockedProductRepository.update).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        expect.objectContaining({ minStock: 10 })
      );
    });

    test('rechaza un insumo manual con precio', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      await expect(
        updateProduct(BRANCH_ID, 1, {
          price: 150,
        } as unknown as ProductUpdate)
      ).rejects.toThrow('Los insumos manuales no pueden tener precio.');
    });

    test('elimina las recetas al cambiar el tipo de un producto compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'compound',
        branchId: BRANCH_ID,
      } as ProductRow);

      mockedDb.query.recipes.findMany.mockResolvedValue([]);

      const data = { type: 'manual_supply', price: 0 } as unknown as ProductInsert;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      const result = await updateProduct(BRANCH_ID, 1, data);

      expect(result!.type).toBe('manual_supply');
      expect(mockedDb.delete).toHaveBeenCalledWith(recipes);
      expect(mockedDb.where).toHaveBeenCalled();
      expect(mockedProductRepository.update).toHaveBeenCalledWith(BRANCH_ID, 1, data);
    });

    test('rechaza criticalSupplyType sin type en un producto no crítico', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      await expect(
        updateProduct(BRANCH_ID, 1, {
          criticalSupplyType: 'bread',
          price: 0,
        } as unknown as ProductUpdate)
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza quitar criticalSupplyType de un insumo crítico', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        branchId: BRANCH_ID,
      } as ProductRow);

      await expect(
        updateProduct(BRANCH_ID, 1, {
          criticalSupplyType: null,
          price: 100,
        } as unknown as ProductUpdate)
      ).rejects.toThrow(ValidationError);
    });

    test('actualiza sin cambiar el tipo y no borra recetas', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      const data = { name: 'Nuevo nombre', price: 0 } as unknown as ProductInsert;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      const result = await updateProduct(BRANCH_ID, 1, data);

      expect(result!.name).toBe('Nuevo nombre');
      expect(mockedDb.delete).not.toHaveBeenCalled();
      expect(mockedProductRepository.update).toHaveBeenCalledWith(BRANCH_ID, 1, data);
    });

    test('permite cambiar un producto a tipo service', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      mockedDb.query.recipes.findMany.mockResolvedValue([]);

      const data = {
        type: 'service',
        criticalSupplyType: null,
        price: 200,
      } as unknown as ProductInsert;

      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      const result = await updateProduct(BRANCH_ID, 1, data);

      expect(result!.type).toBe('service');
      expect(mockedProductRepository.update).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        expect.objectContaining({
          type: 'service',
          stock: 0,
          minStock: 0,
        })
      );
    });

    test('fuerza stock y minStock a 0 al actualizar un producto compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'compound',
        branchId: BRANCH_ID,
      } as ProductRow);

      mockedDb.query.recipes.findMany.mockResolvedValue([]);

      const data = {
        name: 'Panchuque actualizado',
        price: 2000,
        stock: 15,
        minStock: 5,
      } as unknown as ProductInsert;

      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      const result = await updateProduct(BRANCH_ID, 1, data);

      expect(result!.name).toBe('Panchuque actualizado');
      expect(mockedProductRepository.update).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        expect.objectContaining({ stock: 0, minStock: 0 })
      );
    });

    test('fuerza stock y minStock a 0 al actualizar un servicio', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'service',
        branchId: BRANCH_ID,
      } as ProductRow);

      const data = {
        name: 'Servicio actualizado',
        price: 300,
        stock: 10,
        minStock: 5,
      } as unknown as ProductInsert;

      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      const result = await updateProduct(BRANCH_ID, 1, data);

      expect(result!.name).toBe('Servicio actualizado');
      expect(mockedProductRepository.update).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        expect.objectContaining({ stock: 0, minStock: 0 })
      );
    });

    test('permite editar minStock en un producto no compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
        branchId: BRANCH_ID,
      } as ProductRow);

      const data = { name: 'Nuevo nombre', price: 0, minStock: 12 } as unknown as ProductInsert;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as ProductRow);

      await updateProduct(BRANCH_ID, 1, data);

      expect(mockedProductRepository.update).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        expect.objectContaining({ minStock: 12 })
      );
    });
  });

  describe('deleteProduct', () => {
    test('marca como eliminado un producto sin recetas', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedDb.query.recipes.findMany.mockResolvedValue([]);
      mockedProductRepository.softDelete.mockResolvedValue({
        id: 1,
        deletedAt: new Date(),
      } as ProductRow);

      const result = await deleteProduct(BRANCH_ID, 1);

      expect(result!.id).toBe(1);
      expect(mockedProductRepository.softDelete).toHaveBeenCalledWith(BRANCH_ID, 1);
    });

    test('no elimina recetas al marcar como eliminada una promo', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Panchuque',
        type: 'compound',
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedDb.query.recipes.findMany.mockResolvedValue([]);
      mockedProductRepository.softDelete.mockResolvedValue({
        id: 1,
        deletedAt: new Date(),
      } as ProductRow);

      await deleteProduct(BRANCH_ID, 1);

      expect(mockedProductRepository.softDelete).toHaveBeenCalledWith(BRANCH_ID, 1);
    });

    test('rechaza eliminar un insumo crítico usado en una promo activa', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedDb.query.recipes.findMany.mockResolvedValue([
        {
          compoundProduct: {
            type: 'compound',
            deletedAt: null,
            isActive: true,
            name: 'Panchuque',
          },
        },
      ]);

      await expect(deleteProduct(BRANCH_ID, 1)).rejects.toThrow(ValidationError);
      await expect(deleteProduct(BRANCH_ID, 1)).rejects.toThrow(
        "No se puede eliminar 'Pan' porque forma parte de la promo activa 'Panchuque'."
      );
      expect(mockedProductRepository.softDelete).not.toHaveBeenCalled();
    });

    test('rechaza eliminar un insumo crítico usado en varias promos activas', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedDb.query.recipes.findMany.mockResolvedValue([
        {
          compoundProduct: {
            type: 'compound',
            deletedAt: null,
            isActive: true,
            name: 'Panchuque',
          },
        },
        {
          compoundProduct: {
            type: 'compound',
            deletedAt: null,
            isActive: true,
            name: 'Panchuque doble',
          },
        },
      ]);

      await expect(deleteProduct(BRANCH_ID, 1)).rejects.toThrow(ValidationError);
      await expect(deleteProduct(BRANCH_ID, 1)).rejects.toThrow(
        "No se puede eliminar 'Pan' porque forma parte de las promos activas: 'Panchuque', 'Panchuque doble'."
      );
      expect(mockedProductRepository.softDelete).not.toHaveBeenCalled();
    });

    test('rechaza eliminar un insumo usado en promo activa, inactiva y eliminada', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedDb.query.recipes.findMany.mockResolvedValue([
        {
          compoundProduct: {
            type: 'compound',
            deletedAt: null,
            isActive: true,
            name: 'Panchuque activa',
          },
        },
        {
          compoundProduct: {
            type: 'compound',
            deletedAt: null,
            isActive: false,
            name: 'Panchuque inactiva',
          },
        },
        {
          compoundProduct: {
            type: 'compound',
            deletedAt: new Date(),
            isActive: true,
            name: 'Panchuque eliminada',
          },
        },
      ]);

      await expect(deleteProduct(BRANCH_ID, 1)).rejects.toThrow(ValidationError);
      await expect(deleteProduct(BRANCH_ID, 1)).rejects.toThrow(
        "No se puede eliminar 'Pan' porque forma parte de la promo activa 'Panchuque activa'."
      );
    });

    test('no elimina recetas huérfanas al eliminar un insumo', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedDb.query.recipes.findMany.mockResolvedValue([
        {
          compoundProduct: {
            type: 'compound',
            deletedAt: new Date(),
            isActive: true,
            name: 'Panchuque eliminada',
          },
        },
      ]);
      mockedProductRepository.softDelete.mockResolvedValue({
        id: 1,
        deletedAt: new Date(),
      } as ProductRow);

      await deleteProduct(BRANCH_ID, 1);

      expect(mockedProductRepository.softDelete).toHaveBeenCalledWith(BRANCH_ID, 1);
    });
  });

  describe('restoreProduct', () => {
    test('restaura un producto', async () => {
      mockedProductRepository.restore.mockResolvedValue({
        id: 1,
        name: 'Pan',
      } as ProductRow);

      const result = await restoreProduct(BRANCH_ID, 1);

      expect(result!.id).toBe(1);
      expect(mockedProductRepository.restore).toHaveBeenCalledWith(BRANCH_ID, 1);
    });
  });

  describe('permanentlyDeleteProduct', () => {
    beforeEach(() => {
      mockedDb.query.saleItems.findFirst.mockResolvedValue(undefined);
      mockedDb.query.orderItems.findFirst.mockResolvedValue(undefined);
      mockedDb.query.saleItemRecipes.findFirst.mockResolvedValue(undefined);
      mockedDb.query.orderItemRecipes.findFirst.mockResolvedValue(undefined);
      mockedDb.query.orderStockReservations.findFirst.mockResolvedValue(undefined);
      mockedDb.query.stockMovements.findFirst.mockResolvedValue(undefined);
      mockedDb.query.recipes.findFirst.mockResolvedValue(undefined);
    });

    test('rechaza eliminar un producto que no está en papelera', async () => {
      mockedProductRepository.findByIdForUpdate.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        deletedAt: null,
        branchId: BRANCH_ID,
      } as ProductRow);

      await expect(permanentlyDeleteProduct(BRANCH_ID, 1)).rejects.toThrow(
        ValidationError
      );
      expect(mockedProductRepository.hardDelete).not.toHaveBeenCalled();
    });

    test('rechaza eliminar un producto con ventas asociadas', async () => {
      mockedProductRepository.findByIdForUpdate.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        deletedAt: new Date(),
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedDb.query.saleItems.findFirst.mockResolvedValue({ id: 1 });

      await expect(permanentlyDeleteProduct(BRANCH_ID, 1)).rejects.toThrow(
        ValidationError
      );
      expect(mockedProductRepository.hardDelete).not.toHaveBeenCalled();
    });

    test('elimina permanentemente un producto en papelera y borra la imagen', async () => {
      mockedProductRepository.findByIdForUpdate.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        deletedAt: new Date(),
        imageKey: 'product-images/1/test.webp',
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedProductRepository.hardDelete.mockResolvedValue({
        id: 1,
        name: 'Pan',
        deletedAt: new Date(),
        imageKey: 'product-images/1/test.webp',
      } as ProductRow);

      const result = await permanentlyDeleteProduct(BRANCH_ID, 1);

      expect(result!.id).toBe(1);
      expect(mockedProductRepository.hardDelete).toHaveBeenCalledWith(
        BRANCH_ID,
        1,
        db
      );
      expect(mockedProductImageStorage.deleteProductImage).toHaveBeenCalledWith(
        'product-images/1/test.webp'
      );
    });

    test('elimina permanentemente un producto en papelera sin imagen', async () => {
      mockedProductRepository.findByIdForUpdate.mockResolvedValue({
        id: 1,
        name: 'Pan',
        type: 'critical_supply',
        deletedAt: new Date(),
        imageKey: null,
        branchId: BRANCH_ID,
      } as ProductRow);
      mockedProductRepository.hardDelete.mockResolvedValue({
        id: 1,
        name: 'Pan',
        deletedAt: new Date(),
        imageKey: null,
      } as ProductRow);

      await permanentlyDeleteProduct(BRANCH_ID, 1);

      expect(
        mockedProductImageStorage.deleteProductImage
      ).not.toHaveBeenCalled();
    });
  });

  describe('aislamiento por sucursal', () => {
    test('no expone un producto de otra sucursal', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(getProductById(BRANCH_ID, 999)).rejects.toThrow(NotFoundError);
      expect(mockedProductRepository.findById).toHaveBeenCalledWith(BRANCH_ID, 999, false);
    });

    test('rechaza editar un producto de otra sucursal', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(
        updateProduct(BRANCH_ID, 999, { name: 'Otro nombre' })
      ).rejects.toThrow(NotFoundError);
    });

    test('rechaza eliminar un producto de otra sucursal', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(deleteProduct(BRANCH_ID, 999)).rejects.toThrow(NotFoundError);
    });
  });
});
