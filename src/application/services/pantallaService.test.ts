import {
  getSettings,
  updateSettings,
  listEnabledItems,
  listPlaylist,
  listCandidates,
  savePlaylist,
} from './pantallaService';
import * as pantallaRepository from '@/repositories/pantallaRepository';
import * as productRepository from '@/repositories/productRepository';
import * as videoRepository from '@/repositories/videoRepository';
import * as catalogRepository from '@/repositories/catalogRepository';
import * as saleService from '@/application/services/saleService';
import { ValidationError } from '@/domain/errors';
import type {
  PantallaItemRow,
  PantallaSettingsRow,
  ProductRow,
  VideoRow,
} from '@/domain/types';
import type { PantallaItemWithRef } from '@/repositories/pantallaRepository';

jest.mock('@/repositories/pantallaRepository');
jest.mock('@/repositories/productRepository');
jest.mock('@/repositories/videoRepository');
jest.mock('@/repositories/catalogRepository');
jest.mock('@/application/services/saleService');
jest.mock('@/application/transactionService', () => ({
  executeInTransaction: jest.fn((fn: (tx: unknown) => unknown) =>
    fn('tx-mock')
  ),
}));

const mockedRepository = pantallaRepository as jest.Mocked<
  typeof pantallaRepository
>;
const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedVideoRepository = videoRepository as jest.Mocked<
  typeof videoRepository
>;
const mockedCatalogRepository = catalogRepository as jest.Mocked<
  typeof catalogRepository
>;
const mockedSaleService = saleService as jest.Mocked<typeof saleService>;

const BRANCH_ID = 1;

function makeSettingsRow(
  overrides: Partial<PantallaSettingsRow> = {}
): PantallaSettingsRow {
  return {
    branchId: BRANCH_ID,
    playlistMode: 'custom',
    productoMs: 4000,
    sucursalMs: 9000,
    qrMs: 15000,
    videoMaxMs: 60000,
    maxProductos: 7,
    showBranchScene: false,
    showQrScene: true,
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeItemRow(overrides: Partial<PantallaItemRow>): PantallaItemRow {
  return {
    id: 1,
    branchId: BRANCH_ID,
    kind: 'product',
    productId: 10,
    videoId: null,
    position: 0,
    isEnabled: true,
    createdAt: new Date(),
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

function makeVideo(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    id: 7,
    branchId: BRANCH_ID,
    title: 'Promo',
    description: null,
    fileUrl: 'https://example.com/v.mp4',
    mimeType: 'video/mp4',
    size: 1000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

const VALID_SETTINGS_INPUT = {
  playlistMode: 'custom',
  productoMs: 5000,
  sucursalMs: 8000,
  qrMs: 12000,
  videoMaxMs: 120000,
  maxProductos: '20',
  showBranchScene: true,
  showQrScene: false,
};

describe('pantallaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    test('sin fila devuelve los defaults de entorno (modo auto)', async () => {
      mockedRepository.findSettings.mockResolvedValue(null);

      const settings = await getSettings(BRANCH_ID);

      expect(settings.playlistMode).toBe('auto');
      expect(settings.productoMs).toBe(6000);
      expect(settings.sucursalMs).toBe(8000);
      expect(settings.qrMs).toBe(12000);
      expect(settings.videoMaxMs).toBe(120000);
      expect(settings.maxProductos).toBe(15);
      expect(settings.showBranchScene).toBe(true);
      expect(settings.showQrScene).toBe(true);
    });

    test('con fila devuelve la configuración persistida', async () => {
      mockedRepository.findSettings.mockResolvedValue(makeSettingsRow());

      const settings = await getSettings(BRANCH_ID);

      expect(settings.playlistMode).toBe('custom');
      expect(settings.productoMs).toBe(4000);
      expect(settings.maxProductos).toBe(7);
      expect(settings.showBranchScene).toBe(false);
    });
  });

  describe('updateSettings', () => {
    test('persiste una configuración válida (maxProductos coerceado)', async () => {
      mockedRepository.upsertSettings.mockResolvedValue(makeSettingsRow());

      await updateSettings(BRANCH_ID, VALID_SETTINGS_INPUT);

      expect(mockedRepository.upsertSettings).toHaveBeenCalledWith(
        BRANCH_ID,
        expect.objectContaining({
          playlistMode: 'custom',
          productoMs: 5000,
          maxProductos: 20,
          showQrScene: false,
        })
      );
    });

    test('rechaza duraciones por debajo del mínimo', async () => {
      await expect(
        updateSettings(BRANCH_ID, { ...VALID_SETTINGS_INPUT, productoMs: 500 })
      ).rejects.toThrow(ValidationError);
      expect(mockedRepository.upsertSettings).not.toHaveBeenCalled();
    });

    test('rechaza un modo de playlist inválido', async () => {
      await expect(
        updateSettings(BRANCH_ID, {
          ...VALID_SETTINGS_INPUT,
          playlistMode: 'aleatorio',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('listEnabledItems', () => {
    test('mapea solo ítems habilitados a { kind, refId }', async () => {
      mockedRepository.findItems.mockResolvedValue([
        makeItemRow({ kind: 'product', productId: 10 }),
        makeItemRow({
          kind: 'video',
          productId: null,
          videoId: 7,
          position: 1,
        }),
      ]);

      const items = await listEnabledItems(BRANCH_ID);

      expect(mockedRepository.findItems).toHaveBeenCalledWith(BRANCH_ID, {
        enabledOnly: true,
      });
      expect(items).toEqual([
        { kind: 'product', refId: 10 },
        { kind: 'video', refId: 7 },
      ]);
    });
  });

  describe('listPlaylist', () => {
    function mockRows(
      rows: { item: Partial<PantallaItemRow>; product?: Partial<ProductRow> | null; video?: Partial<VideoRow> | null }[]
    ) {
      mockedRepository.findItemsWithRefs.mockResolvedValue(
        rows.map((row) => ({
          item: makeItemRow(row.item),
          product:
            row.product === undefined
              ? null
              : row.product === null
                ? null
                : makeProduct(row.product),
          video:
            row.video === undefined
              ? null
              : row.video === null
                ? null
                : makeVideo(row.video),
        })) as PantallaItemWithRef[]
      );
    }

    test('deriva el estado de cada ítem para el editor', async () => {
      mockRows([
        { item: { id: 1, productId: 10 }, product: {} },
        { item: { id: 2, productId: 11, position: 1 }, product: { id: 11 } },
        {
          item: { id: 3, productId: 12, position: 2 },
          product: { id: 12, isActive: false },
        },
        {
          item: { id: 4, productId: 13, position: 3 },
          product: { id: 13, type: 'manual_supply' },
        },
        {
          item: { id: 5, kind: 'video', productId: null, videoId: 7, position: 4 },
          video: { id: 7, isActive: false },
        },
        {
          item: { id: 6, kind: 'video', productId: null, videoId: 8, position: 5 },
          video: null,
        },
      ]);
      mockedSaleService.calculateAvailabilityForProductIds.mockResolvedValue({
        10: { availability: 5 },
        11: { availability: 0 },
        12: { availability: 3 },
        13: { availability: 9 },
      } as never);

      const items = await listPlaylist(BRANCH_ID);

      expect(items.map((i) => [i.refId, i.status])).toEqual([
        [10, 'ok'],
        [11, 'sin_stock'],
        [12, 'inactivo'],
        [13, 'no_vendible'],
        [7, 'inactivo'],
        [8, 'eliminado'],
      ]);
      expect(items[0].name).toBe('Pancho especial');
      expect(items[4].name).toBe('Promo');
    });
  });

  describe('listCandidates', () => {
    test('devuelve productos públicos con disponibilidad y videos no eliminados', async () => {
      mockedCatalogRepository.findPublicProducts.mockResolvedValue([
        makeProduct({ id: 10 }),
      ]);
      mockedVideoRepository.findAllNonDeleted.mockResolvedValue([
        makeVideo({ id: 7 }),
        makeVideo({ id: 8, isActive: false }),
      ]);
      mockedSaleService.calculateAvailabilityForProductIds.mockResolvedValue({
        10: { availability: 3 },
      } as never);

      const candidates = await listCandidates(BRANCH_ID);

      expect(candidates.products).toEqual([
        expect.objectContaining({ id: 10, availability: 3 }),
      ]);
      expect(candidates.videos).toEqual([
        expect.objectContaining({ id: 7, isActive: true }),
        expect.objectContaining({ id: 8, isActive: false }),
      ]);
    });
  });

  describe('savePlaylist', () => {
    const VALID_ITEMS = [
      { kind: 'product', refId: 10, isEnabled: true },
      { kind: 'video', refId: 7, isEnabled: false },
    ];

    test('reemplaza la playlist en transacción con posiciones densas', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([makeProduct()]);
      mockedVideoRepository.findByIds.mockResolvedValue([makeVideo()]);
      mockedRepository.insertItems.mockResolvedValue([] as never);

      await savePlaylist(BRANCH_ID, VALID_ITEMS);

      expect(mockedRepository.deleteItemsByBranch).toHaveBeenCalledWith(
        'tx-mock',
        BRANCH_ID
      );
      expect(mockedRepository.insertItems).toHaveBeenCalledWith('tx-mock', [
        {
          branchId: BRANCH_ID,
          kind: 'product',
          productId: 10,
          videoId: null,
          position: 0,
          isEnabled: true,
        },
        {
          branchId: BRANCH_ID,
          kind: 'video',
          productId: null,
          videoId: 7,
          position: 1,
          isEnabled: false,
        },
      ]);
    });

    test('rechaza un producto que no existe en la sucursal', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([]);
      mockedVideoRepository.findByIds.mockResolvedValue([makeVideo()]);

      await expect(savePlaylist(BRANCH_ID, VALID_ITEMS)).rejects.toThrow(
        /no existe en esta sucursal/
      );
      expect(mockedRepository.insertItems).not.toHaveBeenCalled();
    });

    test('rechaza un producto eliminado o no vendible al público', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([
        makeProduct({ deletedAt: new Date() }),
      ]);
      mockedVideoRepository.findByIds.mockResolvedValue([makeVideo()]);

      await expect(savePlaylist(BRANCH_ID, VALID_ITEMS)).rejects.toThrow(
        /está eliminado/
      );

      mockedProductRepository.findByIds.mockResolvedValue([
        makeProduct({ type: 'manual_supply' }),
      ]);

      await expect(savePlaylist(BRANCH_ID, VALID_ITEMS)).rejects.toThrow(
        /no es vendible al público/
      );
    });

    test('rechaza un video eliminado', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([makeProduct()]);
      mockedVideoRepository.findByIds.mockResolvedValue([
        makeVideo({ deletedAt: new Date() }),
      ]);

      await expect(savePlaylist(BRANCH_ID, VALID_ITEMS)).rejects.toThrow(
        /está eliminado/
      );
    });

    test('acepta referencias inactivas (quedan en pausa)', async () => {
      mockedProductRepository.findByIds.mockResolvedValue([
        makeProduct({ isActive: false }),
      ]);
      mockedVideoRepository.findByIds.mockResolvedValue([
        makeVideo({ isActive: false }),
      ]);
      mockedRepository.insertItems.mockResolvedValue([] as never);

      await savePlaylist(BRANCH_ID, VALID_ITEMS);

      expect(mockedRepository.insertItems).toHaveBeenCalled();
    });

    test('rechaza ítems duplicados y payloads inválidos', async () => {
      await expect(
        savePlaylist(BRANCH_ID, [
          { kind: 'product', refId: 10 },
          { kind: 'product', refId: 10 },
        ])
      ).rejects.toThrow(ValidationError);

      await expect(
        savePlaylist(BRANCH_ID, [{ kind: 'promo', refId: 10 }])
      ).rejects.toThrow(ValidationError);

      expect(mockedRepository.insertItems).not.toHaveBeenCalled();
    });
  });
});
