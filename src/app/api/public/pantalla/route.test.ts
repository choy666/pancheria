/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import * as branchResolver from '@/lib/branch-resolver';
import * as pantallaSnapshot from '@/lib/pantalla-snapshot';

jest.mock('@/lib/branch-resolver');
jest.mock('@/lib/pantalla-snapshot', () => ({
  buildPantallaSnapshot: jest.fn(),
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
const mockedBuildSnapshot = pantallaSnapshot.buildPantallaSnapshot as jest.MockedFunction<
  typeof pantallaSnapshot.buildPantallaSnapshot
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
  videos: [
    {
      id: 7,
      title: 'Promo',
      fileUrl: 'https://blob.example.com/v7.mp4',
      mimeType: 'video/mp4',
    },
  ],
  settings: {
    playlistMode: 'auto',
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

function buildRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/public/pantalla${query ? `?${query}` : ''}`
  );
}

describe('GET /api/public/pantalla', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBranchResolver.resolvePublicBranchId.mockResolvedValue(BRANCH_ID);
    mockedBuildSnapshot.mockResolvedValue(SNAPSHOT as any);
  });

  test('devuelve el snapshot de la pantalla', async () => {
    const response = await GET(buildRequest(`branchId=${BRANCH_ID}`));
    const body = (await response.json()) as typeof SNAPSHOT;

    expect(response.status).toBe(200);
    expect(body.branch.id).toBe(BRANCH_ID);
    expect(body.isOpen).toBe(true);
    expect(body.products).toHaveLength(1);
    expect(body.videos).toHaveLength(1);
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
