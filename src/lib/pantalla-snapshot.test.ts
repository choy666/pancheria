/**
 * @jest-environment node
 */
import { buildPantallaSnapshot } from './pantalla-snapshot';
import * as catalogService from '@/application/services/catalogService';
import * as videoService from '@/application/services/videoService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as pantallaService from '@/application/services/pantallaService';
import {
  isBranchOpen,
  getTodayOpening,
  getNextOpening,
} from '@/lib/branch-helpers';
import { extractVideoKeyFromUrl } from '@/lib/storage';
import { getStorageProvider } from '@/config/videos';

jest.mock('@/application/services/catalogService');
jest.mock('@/application/services/videoService');
jest.mock('@/application/services/cashRegisterService');
jest.mock('@/application/services/brandService', () => ({
  getBrand: jest.fn(async () => ({ name: 'Pancheria Popular', logoUpdatedAt: null })),
}));
jest.mock('@/application/services/pantallaService');
jest.mock('@/lib/branch-helpers', () => ({
  isBranchOpen: jest.fn(),
  getTodayOpening: jest.fn(),
  getNextOpening: jest.fn(),
}));
jest.mock('@/lib/storage', () => ({
  extractVideoKeyFromUrl: jest.fn(),
  getStorageProvider: jest.fn(),
}));
jest.mock('@/config/videos', () => ({
  getStorageProvider: jest.fn(() => 'vercel-blob'),
}));

const mockedCatalogService = catalogService as jest.Mocked<
  typeof catalogService
>;
const mockedVideoService = videoService as jest.Mocked<typeof videoService>;
const mockedCashRegisterService = cashRegisterService as jest.Mocked<
  typeof cashRegisterService
>;
const mockedPantallaService = pantallaService as jest.Mocked<
  typeof pantallaService
>;

const SETTINGS = {
  playlistMode: 'auto' as const,
  productoMs: 6000,
  sucursalMs: 8000,
  qrMs: 12000,
  videoMaxMs: 120000,
  maxProductos: 15,
  showBranchScene: true,
  showQrScene: true,
};

const ITEMS = [{ kind: 'product' as const, refId: 10 }];
const mockedIsBranchOpen = isBranchOpen as jest.MockedFunction<
  typeof isBranchOpen
>;
const mockedGetTodayOpening = getTodayOpening as jest.MockedFunction<
  typeof getTodayOpening
>;
const mockedGetNextOpening = getNextOpening as jest.MockedFunction<
  typeof getNextOpening
>;
const mockedExtractVideoKey = extractVideoKeyFromUrl as jest.MockedFunction<
  typeof extractVideoKeyFromUrl
>;
const mockedGetStorageProvider = getStorageProvider as jest.MockedFunction<
  typeof getStorageProvider
>;

const BRANCH_ID = 3;

const BRANCH = {
  id: BRANCH_ID,
  name: 'Sucursal Test',
  openingHours: [{ dayOfWeek: 1, open: '12:00', close: '23:00' }],
  address: 'Calle 123',
  phones: [],
  socialLinks: [],
  location: null,
  isActive: true,
  createdAt: new Date(),
};

function mockCatalog(products: unknown[] = [], branch = BRANCH) {
  mockedCatalogService.listPublicCatalogWithAvailability.mockResolvedValue({
    branch,
    products,
    total: products.length,
  } as any);
}

function makeVideoRow(id: number, fileUrl: string) {
  return {
    id,
    branchId: BRANCH_ID,
    title: `Video ${id}`,
    description: null,
    fileUrl,
    mimeType: 'video/mp4',
    size: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

describe('buildPantallaSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalog();
    mockedVideoService.listActiveVideos.mockResolvedValue([]);
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
    } as any);
    mockedIsBranchOpen.mockReturnValue(true);
    mockedGetTodayOpening.mockReturnValue('Hoy de 12:00 a 23:00');
    mockedGetNextOpening.mockReturnValue('Mañana de 12:00 a 23:00');
    mockedGetStorageProvider.mockReturnValue('vercel-blob');
    mockedPantallaService.getSettings.mockResolvedValue(SETTINGS);
    mockedPantallaService.listEnabledItems.mockResolvedValue(ITEMS);
  });

  test('devuelve el snapshot completo con sucursal abierta', async () => {
    mockCatalog([
      {
        id: 10,
        name: 'Pancho especial',
        type: 'compound',
        price: 5000,
        availability: 4,
      },
    ]);
    mockedVideoService.listActiveVideos.mockResolvedValue([
      makeVideoRow(7, 'https://blob.example.com/v7.mp4'),
    ] as any);

    const snapshot = await buildPantallaSnapshot(BRANCH_ID);

    expect(snapshot.branch.id).toBe(BRANCH_ID);
    expect(snapshot.isOpen).toBe(true);
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.videos).toEqual([
      {
        id: 7,
        title: 'Video 7',
        fileUrl: 'https://blob.example.com/v7.mp4',
        mimeType: 'video/mp4',
      },
    ]);
    expect(snapshot.message).toContain('abierta');
    expect(snapshot.settings).toEqual(SETTINGS);
    expect(snapshot.items).toEqual(ITEMS);
    expect(mockedPantallaService.getSettings).toHaveBeenCalledWith(BRANCH_ID);
    expect(mockedPantallaService.listEnabledItems).toHaveBeenCalledWith(
      BRANCH_ID
    );
  });

  test('marca cerrada cuando no hay caja abierta', async () => {
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(null);

    const snapshot = await buildPantallaSnapshot(BRANCH_ID);

    expect(snapshot.isOpen).toBe(false);
    expect(snapshot.message).toContain('cerrada');
  });

  test('sin horarios basta una caja abierta para quedar abierta', async () => {
    mockCatalog([], { ...BRANCH, openingHours: [] });
    mockedIsBranchOpen.mockReturnValue(false);

    const snapshot = await buildPantallaSnapshot(BRANCH_ID);

    expect(snapshot.isOpen).toBe(true);
  });

  test('con horarios, cerrada si isBranchOpen es false aun con caja abierta', async () => {
    mockedIsBranchOpen.mockReturnValue(false);

    const snapshot = await buildPantallaSnapshot(BRANCH_ID);

    expect(snapshot.isOpen).toBe(false);
  });

  test('con provider local emite la ruta de stream same-origin', async () => {
    mockedGetStorageProvider.mockReturnValue('local');
    mockedVideoService.listActiveVideos.mockResolvedValue([
      makeVideoRow(9, 'http://host-viejo/api/videos/abc.mp4/stream'),
    ] as any);
    mockedExtractVideoKey.mockReturnValue('abc.mp4');

    const snapshot = await buildPantallaSnapshot(BRANCH_ID);

    expect(snapshot.videos[0].fileUrl).toBe('/api/videos/abc.mp4/stream');
    expect(mockedExtractVideoKey).toHaveBeenCalledWith(
      'http://host-viejo/api/videos/abc.mp4/stream'
    );
  });

  test('con provider local conserva fileUrl si no se extrae key', async () => {
    mockedGetStorageProvider.mockReturnValue('local');
    mockedVideoService.listActiveVideos.mockResolvedValue([
      makeVideoRow(9, 'https://cdn.example.com/v9.mp4'),
    ] as any);
    mockedExtractVideoKey.mockReturnValue(null);

    const snapshot = await buildPantallaSnapshot(BRANCH_ID);

    expect(snapshot.videos[0].fileUrl).toBe('https://cdn.example.com/v9.mp4');
  });
});
