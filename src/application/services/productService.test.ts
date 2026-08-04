import { createProduct, updateProduct, deleteProduct } from './productService';
import * as productRepository from '@/repositories/productRepository';
import { db } from '@/db';
import { ValidationError } from '@/domain/errors';

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

const mockedProductRepository = productRepository as jest.Mocked<typeof productRepository>;

describe('productService', () => {
  afterEach(() => {
    jest.clearAllMocks();
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
          price: 100,
          unit: 'unidad',
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    test('crea un producto válido', async () => {
      const data = {
        name: 'Ketchup',
        type: 'manual_supply',
        price: 150,
        unit: 'unidad',
      } as any;

      mockedProductRepository.create.mockResolvedValue({ id: 1, ...data } as any);

      const result = await createProduct(data);
      expect(result.id).toBe(1);
    });
  });

  describe('deleteProduct', () => {
    test('elimina un producto existente', async () => {
      mockedProductRepository.findById.mockResolvedValue({ id: 1 } as any);
      mockedProductRepository.softDelete.mockResolvedValue({ id: 1 } as any);

      const result = await deleteProduct(1);
      expect(result.id).toBe(1);
      expect(mockedProductRepository.softDelete).toHaveBeenCalledWith(1);
    });
  });

  describe('updateProduct', () => {
    test('rechaza cambio de tipo si el producto es usado en receta', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'critical_supply',
      } as any);

      (db.query.recipes.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

      await expect(
        updateProduct(1, {
          type: 'manual_supply',
          price: 100,
        } as any)
      ).rejects.toThrow(ValidationError);
    });

    test('actualiza un producto válido', async () => {
      mockedProductRepository.findById.mockResolvedValue({
        id: 1,
        type: 'manual_supply',
      } as any);

      (db.query.recipes.findFirst as jest.Mock).mockResolvedValue(undefined);

      const data = { name: 'Nuevo nombre' } as any;
      mockedProductRepository.update.mockResolvedValue({ id: 1, ...data } as any);

      const result = await updateProduct(1, data);
      expect(result.name).toBe('Nuevo nombre');
    });
  });
});
