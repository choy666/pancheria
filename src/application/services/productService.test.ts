import {
  listProducts,
  getProductById,
  listActiveProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
} from './productService';
import * as productRepository from '@/repositories/productRepository';
import { db } from '@/db';
import { recipes } from '@/db/schema';
import { ValidationError, NotFoundError } from '@/domain/errors';

jest.mock('@/repositories/productRepository');
jest.mock('@/db', () => ({
  db: {
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue(undefined),
    query: {
      recipes: {
        findFirst: jest.fn(),
      },
    },
  },
}));

const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedDb = db as unknown as {
  delete: jest.Mock;
  where: jest.Mock;
  query: { recipes: { findFirst: jest.Mock } };
};

describe('productService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listProducts', () => {
    test('lista productos activos por defecto', async () => {
      mockedProductRepository.findAll.mockResolvedValue([
        { id: 1, name: 'Pan' },
        { id: 2, name: 'Gaseosa' },
      ] as any);

      const result = await listProducts();

      expect(result).toHaveLength(2);
      expect(mockedProductRepository.findAll).toHaveBeenCalledWith(false);
    });

    test('puede incluir productos eliminados', async () => {
      mockedProductRepository.findAll.mockResolvedValue([
        { id: 1, name: 'Pan', deletedAt: null },
        { id: 2, name: 'Pan viejo', deletedAt: new Date() },
      ] as any);

      const result = await listProducts(true);

      expect(result).toHaveLength(2);
      expect(mockedProductRepository.findAll).toHaveBeenCalledWith(true);
    });
  });

  describe('getProductById', () => {
    test('obtiene un producto por su ID', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        name: 'Pan',
      } as any);

      const result = await getProductById(1);

      expect(result!.id).toBe(1);
      expect(mockedProductRepository.findById).toHaveBeenCalledWith(1, false);
    });

    test('lanza NotFoundError si el producto no existe', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(getProductById(999)).rejects.toThrow(NotFoundError);
      await expect(getProductById(999)).rejects.toThrow(
        'Producto con ID 999 no encontrado.'
      );
    });
  });

  describe('listActiveProducts', () => {
    test('lista los productos activos', async () => {
      mockedProductRepository.findActive.mockResolvedValue([
        { id: 1, name: 'Pan', isActive: true },
      ] as any);

      const result = await listActiveProducts();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Pan');
      expect(mockedProductRepository.findActive).toHaveBeenCalled();
    });
  });

  describe('createProduct', () => {
    test('rechaza insumo crítico sin tipo crítico', async () => {
      await expect(
        createProduct({
          name: 'Pan',
          type: 'critical_supply',
          price: 100,
          unit: 'unidad',
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza tipo no crítico con tipo crítico', async () => {
      await expect(
        createProduct({
          name: 'Producto',
          type: 'manual_supply',
          criticalSupplyType: 'bread',
          price: 0,
          unit: 'unidad',
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza insumo manual con precio', async () => {
      await expect(
        createProduct({
          name: 'Aderezo',
          type: 'manual_supply',
          price: 150,
          unit: 'unidad',
        } as any)
      ).rejects.toThrow('Los insumos manuales no pueden tener precio.');
    });

    test('crea un producto válido', async () => {
      const data = {
        name: 'Ketchup',
        type: 'manual_supply',
        price: 0,
        unit: 'unidad',
      } as any;

      mockedProductRepository.create.mockResolvedValue({ id: 1, ...data } as any);

      const result = await createProduct(data);
      expect(result!.id).toBe(1);
    });

    test('crea un insumo crítico con tipo válido', async () => {
      const data = {
        name: 'Pan',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        price: 100,
        unit: 'unidad',
      } as any;

      mockedProductRepository.create.mockResolvedValue({ id: 1, ...data } as any);

      const result = await createProduct(data);
      expect(result!.id).toBe(1);
      expect(result!.criticalSupplyType).toBe('bread');
    });

    test('crea un producto compuesto', async () => {
      const data = {
        name: 'Panchuque',
        type: 'compound',
        price: 1500,
        unit: 'unidad',
      } as any;

      mockedProductRepository.create.mockResolvedValue({ id: 1, ...data } as any);

      const result = await createProduct(data);
      expect(result!.id).toBe(1);
      expect(result!.type).toBe('compound');
    });

    test('crea un servicio sin tipo crítico', async () => {
      const data = {
        name: 'Vaso de gaseosa',
        type: 'service',
        price: 500,
        unit: 'unidad',
      } as any;

      mockedProductRepository.create.mockResolvedValue({ id: 1, ...data } as any);

      const result = await createProduct(data);
      expect(result!.id).toBe(1);
      expect(result!.type).toBe('service');
    });
  });

  describe('updateProduct', () => {
    test('rechaza cambio de tipo si el producto es usado en receta', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'critical_supply',
      } as any);

      mockedDb.query.recipes.findFirst.mockResolvedValue({ id: 1 });

      await expect(
        updateProduct(1, {
          type: 'manual_supply',
          price: 0,
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    test('actualiza un producto válido', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
      } as any);

      mockedDb.query.recipes.findFirst.mockResolvedValue(undefined);

      const data = { name: 'Nuevo nombre', price: 0 } as any;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as any);

      const result = await updateProduct(1, data);
      expect(result!.name).toBe('Nuevo nombre');
    });

    test('rechaza un insumo manual con precio', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
      } as any);

      await expect(
        updateProduct(1, {
          price: 150,
        } as any)
      ).rejects.toThrow('Los insumos manuales no pueden tener precio.');
    });

    test('elimina las recetas al cambiar el tipo de un producto compuesto', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'compound',
      } as any);

      mockedDb.query.recipes.findFirst.mockResolvedValue(undefined);

      const data = { type: 'manual_supply', price: 0 } as any;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as any);

      const result = await updateProduct(1, data);

      expect(result!.type).toBe('manual_supply');
      expect(mockedDb.delete).toHaveBeenCalledWith(recipes);
      expect(mockedDb.where).toHaveBeenCalled();
      expect(mockedProductRepository.update).toHaveBeenCalledWith(1, data);
    });

    test('rechaza criticalSupplyType sin type en un producto no crítico', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
      } as any);

      await expect(
        updateProduct(1, {
          criticalSupplyType: 'bread',
          price: 0,
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza quitar criticalSupplyType de un insumo crítico', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'critical_supply',
        criticalSupplyType: 'bread',
      } as any);

      await expect(
        updateProduct(1, {
          criticalSupplyType: null,
          price: 100,
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    test('actualiza sin cambiar el tipo y no borra recetas', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
      } as any);

      const data = { name: 'Nuevo nombre', price: 0 } as any;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as any);

      const result = await updateProduct(1, data);

      expect(result!.name).toBe('Nuevo nombre');
      expect(mockedDb.delete).not.toHaveBeenCalled();
      expect(mockedProductRepository.update).toHaveBeenCalledWith(1, data);
    });

    test('permite cambiar un producto a tipo service', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
      } as any);

      mockedDb.query.recipes.findFirst.mockResolvedValue(undefined);

      const data = {
        type: 'service',
        criticalSupplyType: null,
        price: 200,
      } as any;

      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as any);

      const result = await updateProduct(1, data);

      expect(result!.type).toBe('service');
      expect(mockedProductRepository.update).toHaveBeenCalledWith(1, data);
    });
  });

  describe('deleteProduct', () => {
    test('elimina un producto existente', async () => {
      mockedProductRepository.findById.mockResolvedValue({ id: 1 } as any);
      mockedDb.query.recipes.findFirst.mockResolvedValue(undefined);
      mockedProductRepository.softDelete.mockResolvedValue({ id: 1 } as any);

      const result = await deleteProduct(1);
      expect(result!.id).toBe(1);
      expect(mockedProductRepository.softDelete).toHaveBeenCalledWith(1);
    });

    test('rechaza eliminar un producto usado en una receta', async () => {
      mockedProductRepository.findById.mockResolvedValue({ id: 1 } as any);
      mockedDb.query.recipes.findFirst.mockResolvedValue({ id: 1 } as any);

      await expect(deleteProduct(1)).rejects.toThrow(ValidationError);
      await expect(deleteProduct(1)).rejects.toThrow(
        'No se puede eliminar el producto porque está usado en una receta.'
      );
      expect(mockedProductRepository.softDelete).not.toHaveBeenCalled();
    });

    test('lanza NotFoundError si el producto no existe', async () => {
      mockedProductRepository.findById.mockResolvedValue(null);

      await expect(deleteProduct(999)).rejects.toThrow(NotFoundError);
      expect(mockedProductRepository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('restoreProduct', () => {
    test('restaura un producto eliminado', async () => {
      mockedProductRepository.restore.mockResolvedValue({
        id: 1,
        name: 'Pan',
        deletedAt: null,
      } as any);

      const result = await restoreProduct(1);

      expect(result!.id).toBe(1);
      expect(result!.deletedAt).toBeNull();
      expect(mockedProductRepository.restore).toHaveBeenCalledWith(1);
    });
  });
});
