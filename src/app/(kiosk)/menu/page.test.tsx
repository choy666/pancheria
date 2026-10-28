/**
 * @jest-environment node
 */
import { Suspense } from 'react';
import MenuPage from './page';
import * as branchResolver from '@/lib/branch-resolver';
import * as menuSnapshot from '@/lib/menu-snapshot';
import { redirect } from 'next/navigation';

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

jest.mock('@/lib/branch-resolver', () => ({
  ...jest.requireActual('@/lib/branch-resolver'),
  getDefaultBranchId: jest.fn(),
}));

jest.mock('@/lib/menu-snapshot', () => ({
  buildMenuSnapshot: jest.fn(),
}));

jest.mock('@/application/services/brandService', () => ({
  getBrand: jest.fn(async () => ({ name: 'Pancheria Popular', logoUpdatedAt: null })),
}));

jest.mock('@/application/services/branchService', () => ({
  getBranchById: jest.fn(async () => undefined),
}));

jest.mock('@/components/menu/menu-client', () => ({
  MenuClient: function MenuClient() {
    return null;
  },
}));

jest.mock('@/components/pantalla/pantalla-skeleton', () => ({
  PantallaSkeleton: function PantallaSkeleton() {
    return null;
  },
}));

jest.mock('@/components/pantalla/pantalla-error', () => ({
  PantallaError: function PantallaError() {
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

const mockedBranchResolver = branchResolver as jest.Mocked<
  typeof branchResolver
>;
const mockedBuildSnapshot = menuSnapshot.buildMenuSnapshot as jest.MockedFunction<
  typeof menuSnapshot.buildMenuSnapshot
>;
const mockedRedirect = redirect as jest.MockedFunction<typeof redirect>;

function makeSnapshot(branchId: number) {
  return {
    brand: {
      name: 'Pancheria Popular',
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
    },
    branch: {
      id: branchId,
      name: 'Sucursal Test',
      openingHours: [],
      phones: [],
      socialLinks: [],
      isActive: true,
      createdAt: new Date(),
    },
    isOpen: true,
    currentOpening: 'Hoy de 12:00 a 23:00',
    nextOpening: 'Mañana de 12:00 a 23:00',
    message: 'Sucursal abierta.',
    products: [],
    settings: {
      paginaMs: 12000,
      filasPagina: 4,
      gridColumns: 4,
      fontScale: 'normal' as const,
      showDescriptions: true,
      cardStyle: 'image' as const,
      sortOrder: 'catalog' as const,
      showQrStrip: true,
      hiddenProductIds: [],
      featuredProductIds: [],
      qrStripText: 'Pedí desde tu celu',
    },
  };
}

describe('MenuPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renderiza PantallaError cuando no se encuentra la sucursal por defecto', async () => {
    mockedBranchResolver.getDefaultBranchId.mockResolvedValue(null);

    const element = await MenuPage({ searchParams: Promise.resolve({}) });

    expect(getComponentName(element)).toBe('PantallaError');
  });

  test('redirige a /menu?branchId cuando resuelve la sucursal por defecto', async () => {
    mockedBranchResolver.getDefaultBranchId.mockResolvedValue(1);

    await expect(
      MenuPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/menu?branchId=1');
  });

  test('renderiza MenuClient cuando branchId es válido', async () => {
    mockedBuildSnapshot.mockResolvedValue(makeSnapshot(3));

    const element = await MenuPage({
      searchParams: Promise.resolve({ branchId: '3' }),
    });

    expect(element.type).toBe(Suspense);
    const screen = element.props.children;
    expect(getComponentName(screen)).toBe('MenuScreen');
    expect(screen.props.branchId).toBe(3);

    const result = await screen.type(screen.props);
    expect(getComponentName(result)).toBe('MenuClient');
    expect(result.props.initialSnapshot.branch.id).toBe(3);
  });

  test('renderiza PantallaError cuando el snapshot falla', async () => {
    mockedBuildSnapshot.mockRejectedValue(new Error('Sucursal no encontrada'));

    const element = await MenuPage({
      searchParams: Promise.resolve({ branchId: '999' }),
    });

    const screen = element.props.children;
    const result = await screen.type(screen.props);
    expect(getComponentName(result)).toBe('PantallaError');
  });

  test('redirige a /menu cuando branchId no es un entero positivo', async () => {
    await expect(
      MenuPage({ searchParams: Promise.resolve({ branchId: 'abc' }) })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/menu');
  });
});

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
