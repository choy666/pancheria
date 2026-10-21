/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as branchResolver from '@/lib/branch-resolver';
import * as menuSnapshot from '@/lib/menu-snapshot';

jest.mock('@/lib/branch-resolver');
jest.mock('@/lib/menu-snapshot', () => ({
  buildMenuSnapshot: jest.fn(),
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

const BRANCH_ID = 3;

const SNAPSHOT = {
  branch: {
    id: BRANCH_ID,
    name: 'Sucursal Test',
    openingHours: [],
    phones: [],
    socialLinks: [],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  isOpen: true,
  currentOpening: 'Hoy de 12:00 a 23:00',
  nextOpening: 'Mañana de 12:00 a 23:00',
  message: 'Sucursal abierta.',
  products: [{ id: 10, name: 'Pancho especial', price: 5000, availability: 4 }],
};

function buildRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/menu${query ? `?${query}` : ''}`
  );
}

describe('GET /api/public/menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBranchResolver.resolvePublicBranchId.mockResolvedValue(BRANCH_ID);
    mockedBuildSnapshot.mockResolvedValue(SNAPSHOT as any);
  });

  test('devuelve el snapshot del menú', async () => {
    const response = await GET(buildRequest(`branchId=${BRANCH_ID}`));
    const body = (await response.json()) as typeof SNAPSHOT;

    expect(response.status).toBe(200);
    expect(body.branch.id).toBe(BRANCH_ID);
    expect(body.isOpen).toBe(true);
    expect(body.products).toHaveLength(1);
    expect(mockedBuildSnapshot).toHaveBeenCalledWith(BRANCH_ID);
  });

  test('devuelve 400 cuando la sucursal no se resuelve', async () => {
    mockedBranchResolver.resolvePublicBranchId.mockResolvedValue(null);

    const response = await GET(buildRequest(`branchId=${BRANCH_ID}`));

    expect(response.status).toBe(400);
    expect(mockedBuildSnapshot).not.toHaveBeenCalled();
  });

  test('devuelve 400 cuando branchId es inválido', async () => {
    const response = await GET(buildRequest('branchId=abc'));

    expect(response.status).toBe(400);
  });

  test('resuelve la sucursal por defecto cuando no hay branchId', async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(200);
    expect(mockedBranchResolver.resolvePublicBranchId).toHaveBeenCalledWith(
      null
    );
  });

  test('incluye Cache-Control de CDN en la respuesta 200', async () => {
    const response = await GET(buildRequest(`branchId=${BRANCH_ID}`));

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=0, s-maxage=10, stale-while-revalidate=30'
    );
  });
});
