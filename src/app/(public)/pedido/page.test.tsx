/**
 * @jest-environment node
 */
import { Suspense } from 'react';
import PedidoPage from './page';
import * as branchResolver from '@/lib/branch-resolver';
import * as catalogService from '@/application/services/catalogService';
import * as brandService from '@/application/services/brandService';
import * as branchService from '@/application/services/branchService';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

jest.mock('@/lib/branch-resolver', () => ({
  ...jest.requireActual('@/lib/branch-resolver'),
  getDefaultBranchId: jest.fn(),
  listPublicBranches: jest.fn(),
}));

jest.mock('@/application/services/catalogService', () => ({
  ...jest.requireActual('@/application/services/catalogService'),
  listPublicCatalogWithAvailability: jest.fn(),
}));

jest.mock('@/application/services/brandService', () => ({
  getBrand: jest.fn(),
}));

jest.mock('@/application/services/branchService', () => ({
  getBranchById: jest.fn(),
}));

jest.mock('@/components/pedido/pedido-client', () => ({
  PedidoClient: function PedidoClient() {
    return null;
  },
}));

jest.mock('@/components/pedido/pedido-skeleton', () => ({
  PedidoSkeleton: function PedidoSkeleton() {
    return null;
  },
}));

jest.mock('@/components/pedido/pedido-error', () => ({
  PedidoError: function PedidoError() {
    return null;
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  logError: jest.fn(),
}));

const mockedBranchResolver = branchResolver as jest.Mocked<typeof branchResolver>;
const mockedCatalogService = catalogService as jest.Mocked<typeof catalogService>;
const mockedBrandService = brandService as jest.Mocked<typeof brandService>;
const mockedRedirect = redirect as jest.MockedFunction<typeof redirect>;

function makeBranch(id: number, name: string) {
  return {
    id,
    name,
    openingHours: [],
    phones: [],
    socialLinks: [],
    isActive: true,
    createdAt: new Date(),
  };
}

function makeBrand(overrides: Partial<Awaited<ReturnType<typeof brandService.getBrand>>> = {}) {
  return {
    name: null,
    tagline: null,
    logoUpdatedAt: null,
    legalName: null,
    taxId: null,
    supportEmail: null,
    termsUrl: null,
    privacyUrl: null,
    footerAbout: null,
    paymentMethods: null,
    developedBy: null,
    showHours: true,
    showMap: true,
    showSocial: true,
    faq: [],
    announcementText: null,
    announcementEnabled: false,
    announcementVariant: 'info' as const,
    ...overrides,
  };
}

function makeCatalog(branchId: number) {
  return {
    branch: makeBranch(branchId, 'Sucursal Test'),
    products: [],
    total: 0,
  };
}

describe('PedidoPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBrandService.getBrand.mockResolvedValue(makeBrand());
  });

  test('renderiza PedidoError cuando no se encuentra la sucursal por defecto', async () => {
    mockedBranchResolver.getDefaultBranchId.mockResolvedValue(null);

    const element = await PedidoPage({ searchParams: Promise.resolve({}) });

    expect(getComponentName(element)).toBe('PedidoError');
  });

  test('redirige a /pedido?branchId cuando resuelve la sucursal por defecto', async () => {
    mockedBranchResolver.getDefaultBranchId.mockResolvedValue(1);

    await expect(
      PedidoPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/pedido?branchId=1');
  });

  test('renderiza PedidoClient cuando branchId es válido', async () => {
    mockedBranchResolver.listPublicBranches.mockResolvedValue([
      makeBranch(1, 'Sucursal Test'),
    ]);
    mockedCatalogService.listPublicCatalogWithAvailability.mockResolvedValue(
      makeCatalog(1)
    );

    const element = await PedidoPage({
      searchParams: Promise.resolve({ branchId: '1' }),
    });

    expect(getSuspense(element).type).toBe(Suspense);
    const catalog = getSuspense(element).props.children;
    expect(getComponentName(catalog)).toBe('PedidoCatalog');
    expect(catalog.props.branchId).toBe(1);

    const catalogResult = await catalog.type(catalog.props);
    expect(getComponentName(catalogResult)).toBe('PedidoClient');
  });

  test('renderiza PedidoError cuando la sucursal explícita no existe', async () => {
    mockedBranchResolver.listPublicBranches.mockResolvedValue([]);
    mockedCatalogService.listPublicCatalogWithAvailability.mockRejectedValue(
      new Error('Sucursal no encontrada')
    );

    const element = await PedidoPage({
      searchParams: Promise.resolve({ branchId: '999' }),
    });

    expect(getSuspense(element).type).toBe(Suspense);
    const catalog = getSuspense(element).props.children;
    const catalogResult = await catalog.type(catalog.props);
    expect(getComponentName(catalogResult)).toBe('PedidoError');
  });

  test('muestra el aviso destacado de la marca cuando está activo', async () => {
    mockedBrandService.getBrand.mockResolvedValue(
      makeBrand({
        announcementEnabled: true,
        announcementText: 'Hoy cerramos a las 22',
      })
    );
    mockedBranchResolver.listPublicBranches.mockResolvedValue([
      makeBranch(1, 'Sucursal Test'),
    ]);
    mockedCatalogService.listPublicCatalogWithAvailability.mockResolvedValue(
      makeCatalog(1)
    );

    const element = await PedidoPage({
      searchParams: Promise.resolve({ branchId: '1' }),
    });
    const announcement = element.props.children[1].props.children[0];

    expect(announcement.props.text).toBe('Hoy cerramos a las 22');
  });

  test('redirige a /pedido cuando branchId no es un entero positivo', async () => {
    await expect(
      PedidoPage({ searchParams: Promise.resolve({ branchId: 'abc' }) })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/pedido');
  });
});

function getSuspense(page: any) {
  return page.props.children[1].props.children[1];
}

function getComponentName(element: unknown): string | undefined {
  if (
    typeof element === 'object' &&
    element !== null &&
    'type' in element &&
    typeof (element as { type?: { name?: string } }).type === 'function'
  ) {
    return (element as { type: { name?: string } }).type.name;
  }
  return undefined;
}
