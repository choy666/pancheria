/**
 * @jest-environment node
 */
import { buildMenuSnapshot } from './menu-snapshot';
import * as catalogService from '@/application/services/catalogService';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import * as menuService from '@/application/services/menuService';
import {
  isBranchOpen,
  getTodayOpening,
  getNextOpening,
} from '@/lib/branch-helpers';

jest.mock('@/application/services/catalogService');
jest.mock('@/application/services/cashRegisterService');
jest.mock('@/application/services/brandService', () => ({
  getBrand: jest.fn(async () => ({ name: 'Pancheria Popular', logoUpdatedAt: null })),
}));
jest.mock('@/application/services/menuService');
jest.mock('@/lib/branch-helpers', () => ({
  isBranchOpen: jest.fn(),
  getTodayOpening: jest.fn(),
  getNextOpening: jest.fn(),
}));

const mockedCatalogService = catalogService as jest.Mocked<
  typeof catalogService
>;
const mockedCashRegisterService = cashRegisterService as jest.Mocked<
  typeof cashRegisterService
>;
const mockedMenuService = menuService as jest.Mocked<typeof menuService>;
const mockedIsBranchOpen = isBranchOpen as jest.MockedFunction<
  typeof isBranchOpen
>;
const mockedGetTodayOpening = getTodayOpening as jest.MockedFunction<
  typeof getTodayOpening
>;
const mockedGetNextOpening = getNextOpening as jest.MockedFunction<
  typeof getNextOpening
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

describe('buildMenuSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalog();
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue({
      id: 1,
    } as any);
    mockedIsBranchOpen.mockReturnValue(true);
    mockedGetTodayOpening.mockReturnValue('Hoy de 12:00 a 23:00');
    mockedGetNextOpening.mockReturnValue('Mañana de 12:00 a 23:00');
    mockedMenuService.getSettings.mockResolvedValue({
      paginaMs: 12000,
      filasPagina: 4,
      gridColumns: 4,
      fontScale: 'normal',
      showDescriptions: true,
      cardStyle: 'image',
      sortOrder: 'catalog',
      showQrStrip: true,
      hiddenProductIds: [],
      featuredProductIds: [],
      qrStripText: 'Pedí desde tu celu',
    });
  });

  test('devuelve el snapshot con sucursal abierta y catálogo', async () => {
    mockCatalog([
      {
        id: 10,
        name: 'Pancho especial',
        type: 'compound',
        price: 5000,
        availability: 4,
      },
    ]);

    const snapshot = await buildMenuSnapshot(BRANCH_ID);

    expect(snapshot.branch.id).toBe(BRANCH_ID);
    expect(snapshot.isOpen).toBe(true);
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.message).toContain('abierta');
    expect(mockedMenuService.getSettings).toHaveBeenCalledWith(BRANCH_ID);
    expect(snapshot.settings).toEqual({
      paginaMs: 12000,
      filasPagina: 4,
      gridColumns: 4,
      fontScale: 'normal',
      showDescriptions: true,
      cardStyle: 'image',
      sortOrder: 'catalog',
      showQrStrip: true,
      hiddenProductIds: [],
      featuredProductIds: [],
      qrStripText: 'Pedí desde tu celu',
    });
    // El snapshot del menú no incluye videos ni la playlist de /pantalla.
    expect(snapshot).not.toHaveProperty('videos');
    expect(snapshot).not.toHaveProperty('items');
  });

  test('propaga la configuración personalizada de la sucursal', async () => {
    mockedMenuService.getSettings.mockResolvedValue({
      paginaMs: 9000,
      filasPagina: 2,
      gridColumns: 3,
      fontScale: 'large',
      showDescriptions: false,
      cardStyle: 'compact',
      sortOrder: 'price_asc',
      showQrStrip: false,
      hiddenProductIds: [10],
      featuredProductIds: [20],
      qrStripText: 'Escaneá y pedí',
    });

    const snapshot = await buildMenuSnapshot(BRANCH_ID);

    expect(snapshot.settings.paginaMs).toBe(9000);
    expect(snapshot.settings.gridColumns).toBe(3);
    expect(snapshot.settings.showQrStrip).toBe(false);
    expect(snapshot.settings.hiddenProductIds).toEqual([10]);
    expect(snapshot.settings.featuredProductIds).toEqual([20]);
    expect(snapshot.settings.qrStripText).toBe('Escaneá y pedí');
  });

  test('marca cerrada cuando no hay caja abierta', async () => {
    mockedCashRegisterService.getOpenCashRegister.mockResolvedValue(null);

    const snapshot = await buildMenuSnapshot(BRANCH_ID);

    expect(snapshot.isOpen).toBe(false);
    expect(snapshot.message).toContain('cerrada');
  });

  test('sin horarios basta una caja abierta para quedar abierta', async () => {
    mockCatalog([], { ...BRANCH, openingHours: [] });
    mockedIsBranchOpen.mockReturnValue(false);

    const snapshot = await buildMenuSnapshot(BRANCH_ID);

    expect(snapshot.isOpen).toBe(true);
  });

  test('con horarios, cerrada si isBranchOpen es false aun con caja abierta', async () => {
    mockedIsBranchOpen.mockReturnValue(false);

    const snapshot = await buildMenuSnapshot(BRANCH_ID);

    expect(snapshot.isOpen).toBe(false);
  });
});
