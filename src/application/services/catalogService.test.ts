import {
  listPublicCatalog,
  listPublicCatalogWithAvailability,
  validatePublicCart,
} from './catalogService';
import * as catalogRepository from '@/repositories/catalogRepository';
import * as branchService from '@/application/services/branchService';
import * as saleService from '@/application/services/saleService';
import { NotFoundError } from '@/domain/errors';
import type { ProductRow } from '@/domain/types';

jest.mock('@/repositories/catalogRepository');
jest.mock('@/application/services/branchService');
jest.mock('@/application/services/saleService');

const mockedCatalogRepository = catalogRepository as jest.Mocked<
  typeof catalogRepository
>;
const mockedBranchService = branchService as jest.Mocked<typeof branchService>;
const mockedSaleService = saleService as jest.Mocked<typeof saleService>;

const BRANCH_ID = 1;
const NOW = new Date();

function makeProduct(
  id: number,
  name: string,
  type: ProductRow['type'],
  criticalSupplyType?: ProductRow['criticalSupplyType']
): ProductRow {
  return {
    id,
    branchId: BRANCH_ID,
    name,
    type,
    criticalSupplyType: criticalSupplyType ?? null,
    description: null,
    price: 100,
    unit: 'unidad',
    stock: 10,
    minStock: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe('catalogService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listPublicCatalog', () => {
    test('devuelve productos vendibles mapeados al DTO público', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: BRANCH_ID,
        name: 'Sucursal Test',
        createdAt: NOW,
      });
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Panchuque', 'compound'),
        makeProduct(2, 'Gaseosa', 'critical_supply', 'beverage'),
      ]);

      const result = await listPublicCatalog(BRANCH_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: 'Panchuque',
        description: null,
        type: 'compound',
        criticalSupplyType: null,
        price: 100,
        unit: 'unidad',
        availability: 0,
      });
      expect(result[0]).not.toHaveProperty('branchId');
      expect(result[0]).not.toHaveProperty('stock');
    });

    test('excluye productos no vendibles, inactivos o eliminados (ya filtrados por el repositorio)', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: BRANCH_ID,
        name: 'Sucursal Test',
        createdAt: NOW,
      });
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Gaseosa', 'critical_supply', 'beverage'),
      ]);

      const result = await listPublicCatalog(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('critical_supply');
      expect(result[0].criticalSupplyType).toBe('beverage');
    });

    test('lanza NotFoundError si la sucursal no existe', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(undefined);

      await expect(listPublicCatalog(999)).rejects.toThrow(NotFoundError);
      await expect(listPublicCatalog(999)).rejects.toThrow(
        'Sucursal con ID 999 no encontrado.'
      );
    });
  });

  describe('listPublicCatalogWithAvailability', () => {
    test('calcula y asigna la disponibilidad de cada producto', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: BRANCH_ID,
        name: 'Sucursal Test',
        createdAt: NOW,
      });
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Panchuque', 'compound'),
        makeProduct(2, 'Gaseosa', 'critical_supply', 'beverage'),
        makeProduct(3, 'Vaso', 'service'),
      ]);
      mockedSaleService.calculateAvailabilityForProductIds.mockResolvedValue({
        1: 5,
        2: 12,
        3: Number.MAX_SAFE_INTEGER,
      });

      const result = await listPublicCatalogWithAvailability(BRANCH_ID);

      expect(result).toHaveLength(3);
      expect(result[0].availability).toBe(5);
      expect(result[1].availability).toBe(12);
      expect(result[2].availability).toBe(Number.MAX_SAFE_INTEGER);
      expect(
        mockedSaleService.calculateAvailabilityForProductIds
      ).toHaveBeenCalledWith(BRANCH_ID, [1, 2, 3]);
    });

    test('devuelve disponibilidad 0 si el catálogo está vacío', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: BRANCH_ID,
        name: 'Sucursal Test',
        createdAt: NOW,
      });
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([]);

      const result = await listPublicCatalogWithAvailability(BRANCH_ID);

      expect(result).toEqual([]);
      expect(
        mockedSaleService.calculateAvailabilityForProductIds
      ).not.toHaveBeenCalled();
    });
  });

  describe('validatePublicCart', () => {
    test('expone validateCartAvailability del servicio de ventas', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: BRANCH_ID,
        name: 'Sucursal Test',
        createdAt: NOW,
      });
      mockedSaleService.validateCartAvailability.mockResolvedValue({
        availabilityByProduct: { 1: 5 },
        consumedBySupply: {},
        shortageByProduct: {},
      });

      const items = [{ productId: 1, quantity: 2 }];
      const productIds = [1, 2];

      const result = await validatePublicCart(BRANCH_ID, items, productIds);

      expect(result.availabilityByProduct).toEqual({ 1: 5 });
      expect(result.shortageByProduct).toEqual({});
      expect(mockedSaleService.validateCartAvailability).toHaveBeenCalledWith(
        BRANCH_ID,
        items,
        productIds
      );
    });

    test('descarta consumedBySupply de la respuesta pública', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: BRANCH_ID,
        name: 'Sucursal Test',
        createdAt: NOW,
      });
      mockedSaleService.validateCartAvailability.mockResolvedValue({
        availabilityByProduct: { 1: 5 },
        consumedBySupply: { 10: 2 },
        shortageByProduct: {},
      });

      const result = await validatePublicCart(BRANCH_ID, [
        { productId: 1, quantity: 2 },
      ]);

      expect(result).not.toHaveProperty('consumedBySupply');
    });
  });
});
