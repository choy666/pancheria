import { getSettings, updateSettings, listMenuProducts } from './menuService';
import * as menuRepository from '@/repositories/menuRepository';
import * as productRepository from '@/repositories/productRepository';
import * as catalogRepository from '@/repositories/catalogRepository';
import { ValidationError } from '@/domain/errors';
import type { MenuSettingsRow, ProductRow } from '@/domain/types';

jest.mock('@/repositories/menuRepository');
jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/catalogRepository');

const mockedRepository = menuRepository as jest.Mocked<typeof menuRepository>;
const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedCatalogRepository = catalogRepository as jest.Mocked<
  typeof catalogRepository
>;

const BRANCH_ID = 1;

function makeSettingsRow(
  overrides: Partial<MenuSettingsRow> = {}
): MenuSettingsRow {
  return {
    branchId: BRANCH_ID,
    paginaMs: 9000,
    filasPagina: 3,
    showQrStrip: false,
    hiddenProductIds: [10, 20],
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: 10,
    branchId: BRANCH_ID,
    name: 'Pancho especial',
    description: null,
    type: 'compound',
    criticalSupplyType: null,
    price: 5000,
    unit: 'unidad',
    stock: 10,
    minStock: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

const VALID_SETTINGS_INPUT = {
  paginaMs: 8000,
  filasPagina: '3',
  showQrStrip: false,
  hiddenProductIds: [] as number[],
};

describe('menuService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    test('sin fila devuelve los defaults de entorno', async () => {
      mockedRepository.findSettings.mockResolvedValue(null);

      const settings = await getSettings(BRANCH_ID);

      expect(settings.paginaMs).toBe(12000);
      expect(settings.filasPagina).toBe(4);
      expect(settings.showQrStrip).toBe(true);
      expect(settings.hiddenProductIds).toEqual([]);
    });

    test('con fila devuelve la configuración persistida', async () => {
      mockedRepository.findSettings.mockResolvedValue(makeSettingsRow());

      const settings = await getSettings(BRANCH_ID);

      expect(settings.paginaMs).toBe(9000);
      expect(settings.filasPagina).toBe(3);
      expect(settings.showQrStrip).toBe(false);
      expect(settings.hiddenProductIds).toEqual([10, 20]);
    });
  });

  describe('updateSettings', () => {
    test('persiste una configuración válida (filasPagina coerceada)', async () => {
      mockedRepository.upsertSettings.mockResolvedValue(makeSettingsRow());

      await updateSettings(BRANCH_ID, VALID_SETTINGS_INPUT);

      expect(mockedRepository.upsertSettings).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.objectContaining({
          paginaMs: 8000,
          filasPagina: 3,
          showQrStrip: false,
          hiddenProductIds: [],
        })
      );
      // Sin ocultos no hay validación de referencias contra la base.
      expect(mockedProductRepository.findByIds).not.toHaveBeenCalled();
    });

    test('deduplica y valida los productos ocultos antes de guardar', async () => {
      mockedRepository.upsertSettings.mockResolvedValue(makeSettingsRow());
      mockedProductRepository.findByIds.mockResolvedValue([
        makeProduct({ id: 10 }),
        makeProduct({ id: 20, name: 'Gaseosa', type: 'critical_supply', criticalSupplyType: 'beverage' }),
      ]);

      await updateSettings(BRANCH_ID, {
        ...VALID_SETTINGS_INPUT,
        hiddenProductIds: [10, 20, 10],
      });

      expect(mockedProductRepository.findByIds).toHaveBeenCalledWith(
        BRANCH_ID,
        [10, 20],
        true
      );
      expect(mockedRepository.upsertSettings).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.objectContaining({ hiddenProductIds: [10, 20] })
      );
    });

    test('rechaza duraciones por debajo del mínimo', async () => {
      await expect(
        updateSettings(BRANCH_ID, { ...VALID_SETTINGS_INPUT, paginaMs: 500 })
      ).rejects.toThrow(ValidationError);
      expect(mockedRepository.upsertSettings).not.toHaveBeenCalled();
    });

    test('rechaza menos de una fila por página', async () => {
      await expect(
        updateSettings(BRANCH_ID, { ...VALID_SETTINGS_INPUT, filasPagina: 0 })
      ).rejects.toThrow(ValidationError);
      expect(mockedRepository.upsertSettings).not.toHaveBeenCalled();
    });

    test('rechaza un producto oculto que no existe en la sucursal', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([]);

      await expect(
        updateSettings(BRANCH_ID, {
          ...VALID_SETTINGS_INPUT,
          hiddenProductIds: [999],
        })
      ).rejects.toThrow('no existe en esta sucursal');
      expect(mockedRepository.upsertSettings).not.toHaveBeenCalled();
    });

    test('rechaza un producto oculto eliminado', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([
        makeProduct({ deletedAt: new Date() }),
      ]);

      await expect(
        updateSettings(BRANCH_ID, {
          ...VALID_SETTINGS_INPUT,
          hiddenProductIds: [10],
        })
      ).rejects.toThrow('está eliminado');
      expect(mockedRepository.upsertSettings).not.toHaveBeenCalled();
    });

    test('rechaza ocultar un producto no vendible al público', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([
        makeProduct({ id: 30, type: 'manual_supply', name: 'Papel aluminio' }),
      ]);

      await expect(
        updateSettings(BRANCH_ID, {
          ...VALID_SETTINGS_INPUT,
          hiddenProductIds: [30],
        })
      ).rejects.toThrow('no es vendible al público');
      expect(mockedRepository.upsertSettings).not.toHaveBeenCalled();
    });
  });

  describe('listMenuProducts', () => {
    test('devuelve los productos públicos mapeados a id/nombre/tipo', async () => {
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct({ id: 10, name: 'Promo 2x1', type: 'compound' }),
        makeProduct({
          id: 11,
          name: 'Gaseosa',
          type: 'critical_supply',
          criticalSupplyType: 'beverage',
        }),
      ]);

      const products = await listMenuProducts(BRANCH_ID);

      expect(mockedCatalogRepository.findPublicProducts).toHaveBeenCalledWith(
        BRANCH_ID
      );
      expect(products).toEqual([
        { id: 10, name: 'Promo 2x1', type: 'compound' },
        { id: 11, name: 'Gaseosa', type: 'critical_supply' },
      ]);
    });
  });
});
