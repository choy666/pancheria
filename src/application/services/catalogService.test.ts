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

function makeBranch() {
  return {
    id: BRANCH_ID,
    name: 'Sucursal Test',
    openingHours: [],
    createdAt: NOW,
  };
}

function makePublicProduct(
  id: number,
  name: string,
  type: ProductRow['type'],
  criticalSupplyType?: ProductRow['criticalSupplyType'],
  availability = 0,
  imageUrl: string | null = null
) {
  return {
    id,
    name,
    description: null,
    type,
    criticalSupplyType: criticalSupplyType ?? null,
    price: 100,
    unit: 'unidad',
    imageUrl,
    availability,
  };
}

describe('catalogService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listPublicCatalog', () => {
    test('devuelve la sucursal y productos vendibles mapeados al DTO público', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Panchuque', 'compound'),
        makeProduct(2, 'Gaseosa', 'critical_supply', 'beverage'),
      ]);

      const result = await listPublicCatalog(BRANCH_ID);

      expect(result.branch).toEqual(makeBranch());
      expect(result.products).toHaveLength(2);
      expect(result.products[0]).toEqual(
        makePublicProduct(1, 'Panchuque', 'compound')
      );
      expect(result.products[0]).not.toHaveProperty('branchId');
      expect(result.products[0]).not.toHaveProperty('stock');
      // El desglose de insumos no se transporta al cliente público.
      expect(result.products[0]).not.toHaveProperty('breakdown');
    });

    test('excluye productos no vendibles, inactivos o eliminados (ya filtrados por el repositorio)', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Gaseosa', 'critical_supply', 'beverage'),
      ]);

      const result = await listPublicCatalog(BRANCH_ID);

      expect(result.products).toHaveLength(1);
      expect(result.products[0].type).toBe('critical_supply');
      expect(result.products[0].criticalSupplyType).toBe('beverage');
    });

    test('lanza NotFoundError si la sucursal no existe', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(undefined);

      await expect(listPublicCatalog(999)).rejects.toThrow(NotFoundError);
      await expect(listPublicCatalog(999)).rejects.toThrow(
        'Sucursal con ID 999 no encontrado.'
      );
    });

    test('pasa limit/offset al repositorio y devuelve el total contado', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Panchuque', 'compound'),
      ]);
      mockedCatalogRepository.countPublicProducts.mockResolvedValue(30);

      const result = await listPublicCatalog(BRANCH_ID, { limit: 10, offset: 0 });

      expect(mockedCatalogRepository.findPublicProducts).toHaveBeenCalledWith(
        BRANCH_ID,
        { limit: 10, offset: 0 }
      );
      expect(mockedCatalogRepository.countPublicProducts).toHaveBeenCalledWith(
        BRANCH_ID
      );
      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(30);
    });

    test('sin paginación el total es el largo del listado y no consulta count', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Panchuque', 'compound'),
        makeProduct(2, 'Gaseosa', 'critical_supply', 'beverage'),
      ]);

      const result = await listPublicCatalog(BRANCH_ID);

      expect(result.total).toBe(2);
      expect(mockedCatalogRepository.countPublicProducts).not.toHaveBeenCalled();
    });
  });

  describe('listPublicCatalogWithAvailability', () => {
    test('calcula y asigna la disponibilidad de cada producto', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(1, 'Panchuque', 'compound'),
        makeProduct(2, 'Gaseosa', 'critical_supply', 'beverage'),
        makeProduct(3, 'Vaso', 'service'),
      ]);
      mockedSaleService.calculateAvailabilityForProductIds.mockResolvedValue({
        1: { availability: 5, breakdown: [] },
        2: { availability: 12, breakdown: [] },
        3: { availability: Number.MAX_SAFE_INTEGER, breakdown: [] },
      });

      const result = await listPublicCatalogWithAvailability(BRANCH_ID);

      expect(result.branch).toEqual(makeBranch());
      expect(result.products).toHaveLength(3);
      expect(result.products[0].availability).toBe(5);
      expect(result.products[1].availability).toBe(12);
      expect(result.products[2].availability).toBe(Number.MAX_SAFE_INTEGER);
      expect(
        mockedSaleService.calculateAvailabilityForProductIds
      ).toHaveBeenCalledWith(BRANCH_ID, [1, 2, 3]);
    });

    test('devuelve catálogo vacío si la sucursal no tiene productos', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([]);

      const result = await listPublicCatalogWithAvailability(BRANCH_ID);

      expect(result.branch).toEqual(makeBranch());
      expect(result.products).toEqual([]);
      expect(result.total).toBe(0);
      expect(
        mockedSaleService.calculateAvailabilityForProductIds
      ).not.toHaveBeenCalled();
    });

    test('pagina los productos y calcula disponibilidad solo de la página', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct(3, 'Vaso', 'service'),
      ]);
      mockedCatalogRepository.countPublicProducts.mockResolvedValue(25);
      mockedSaleService.calculateAvailabilityForProductIds.mockResolvedValue({
        3: { availability: Number.MAX_SAFE_INTEGER, breakdown: [] },
      });

      const result = await listPublicCatalogWithAvailability(BRANCH_ID, {
        limit: 5,
        offset: 20,
      });

      expect(mockedCatalogRepository.findPublicProducts).toHaveBeenCalledWith(
        BRANCH_ID,
        { limit: 5, offset: 20 }
      );
      expect(
        mockedSaleService.calculateAvailabilityForProductIds
      ).toHaveBeenCalledWith(BRANCH_ID, [3]);
      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(25);
    });
  });

  describe('validatePublicCart', () => {
    test('expone validateCartAvailability del servicio de ventas', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedSaleService.validateCartAvailability.mockResolvedValue({
        availabilityByProduct: { 1: 5 },
        consumedBySupply: {},
        shortageByProduct: {},
        breakdownByProduct: {},
      });

      const items = [{ productId: 1, quantity: 2 }];

      const result = await validatePublicCart(BRANCH_ID, items);

      expect(result.availabilityByProduct).toEqual({ 1: 5 });
      expect(result.shortageByProduct).toEqual({});
      expect(mockedSaleService.validateCartAvailability).toHaveBeenCalledWith(
        BRANCH_ID,
        items
      );
    });

    test('descarta datos internos de stock de la respuesta pública', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(makeBranch());
      mockedSaleService.validateCartAvailability.mockResolvedValue({
        availabilityByProduct: { 1: 5 },
        consumedBySupply: { 10: 2 },
        shortageByProduct: {
          2: { available: 0, required: 2, supplyName: 'Pan interno' },
        },
        breakdownByProduct: {
          2: [
            {
              supplyName: 'Pan interno',
              available: 0,
              required: 2,
              isLimiting: true,
            },
          ],
        },
      });

      const result = await validatePublicCart(BRANCH_ID, [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ]);

      expect(result).not.toHaveProperty('consumedBySupply');
      expect(result).not.toHaveProperty('breakdownByProduct');
      // El faltante se expone solo como presencia, sin insumo ni cantidades.
      expect(result.shortageByProduct).toEqual({ 2: true });
    });
  });
});
