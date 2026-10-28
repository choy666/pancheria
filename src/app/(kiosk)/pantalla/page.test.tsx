/**
 * @jest-environment node
 */
import { Suspense } from 'react';
import PantallaPage from './page';
import * as branchResolver from '@/lib/branch-resolver';
import * as pantallaSnapshot from '@/lib/pantalla-snapshot';
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

jest.mock('@/lib/pantalla-snapshot', () => ({
  buildPantallaSnapshot: jest.fn(),
}));

jest.mock('@/application/services/brandService', () => ({
  getBrand: jest.fn(async () => ({ name: 'Pancheria Popular', logoUpdatedAt: null })),
}));

jest.mock('@/application/services/branchService', () => ({
  getBranchById: jest.fn(async () => undefined),
}));

jest.mock('@/components/pantalla/pantalla-client', () => ({
  PantallaClient: function PantallaClient() {
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
const mockedBuildSnapshot =
  pantallaSnapshot.buildPantallaSnapshot as jest.MockedFunction<
    typeof pantallaSnapshot.buildPantallaSnapshot
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
    videos: [],
    settings: {
      playlistMode: 'auto' as const,
      productoMs: 6000,
      sucursalMs: 8000,
      qrMs: 12000,
      videoMaxMs: 120000,
      maxProductos: 15,
      showBranchScene: true,
      showQrScene: true,
    },
    items: [],
  };
}

describe('PantallaPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renderiza PantallaError cuando no se encuentra la sucursal por defecto', async () => {
    mockedBranchResolver.getDefaultBranchId.mockResolvedValue(null);

    const element = await PantallaPage({ searchParams: Promise.resolve({}) });

    expect(getComponentName(element)).toBe('PantallaError');
  });

  test('redirige a /pantalla?branchId cuando resuelve la sucursal por defecto', async () => {
    mockedBranchResolver.getDefaultBranchId.mockResolvedValue(1);

    await expect(
      PantallaPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/pantalla?branchId=1');
  });

  test('renderiza PantallaClient cuando branchId es válido', async () => {
    mockedBuildSnapshot.mockResolvedValue(makeSnapshot(3));

    const element = await PantallaPage({
      searchParams: Promise.resolve({ branchId: '3' }),
    });

    expect(element.type).toBe(Suspense);
    const screen = element.props.children;
    expect(getComponentName(screen)).toBe('PantallaScreen');
    expect(screen.props.branchId).toBe(3);

    const result = await screen.type(screen.props);
    expect(getComponentName(result)).toBe('PantallaClient');
    expect(result.props.initialSnapshot.branch.id).toBe(3);
  });

  test('renderiza PantallaError cuando el snapshot falla', async () => {
    mockedBuildSnapshot.mockRejectedValue(new Error('Sucursal no encontrada'));

    const element = await PantallaPage({
      searchParams: Promise.resolve({ branchId: '999' }),
    });

    const screen = element.props.children;
    const result = await screen.type(screen.props);
    expect(getComponentName(result)).toBe('PantallaError');
  });

  test('redirige a /pantalla cuando branchId no es un entero positivo', async () => {
    await expect(
      PantallaPage({ searchParams: Promise.resolve({ branchId: 'abc' }) })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockedRedirect).toHaveBeenCalledWith('/pantalla');
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
