/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as productRepository from '@/repositories/productRepository';
import * as productImageStorage from '@/lib/product-image-storage';
import { requireAuth, requireAdmin, getCurrentBranchId } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/repositories/productRepository');
jest.mock('@/lib/product-image-storage');
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireAdmin: jest.fn(),
  getCurrentBranchId: jest.fn(),
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

const mockedProductRepository = productRepository as jest.Mocked<
  typeof productRepository
>;
const mockedPrepareProductImageUpload = productImageStorage.prepareProductImageUpload as jest.MockedFunction<
  typeof productImageStorage.prepareProductImageUpload
>;
const mockedValidateProductImage = productImageStorage.validateProductImage as jest.MockedFunction<
  typeof productImageStorage.validateProductImage
>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockedGetCurrentBranchId = getCurrentBranchId as jest.MockedFunction<
  typeof getCurrentBranchId
>;

const BRANCH_ID = 1;

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/productos/imagen/preparar', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/productos/imagen/preparar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = {
      user: { name: 'admin', role: 'admin', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAdmin>>;
    mockedRequireAdmin.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Producto',
    } as any);
    mockedPrepareProductImageUpload.mockResolvedValue({
      key: 'product-images/1/abc123.jpg',
      url: 'http://localhost:3000/api/productos/imagen/product-images%2F1%2Fabc123.jpg',
      fields: {},
    } as any);
  });

  test('devuelve las instrucciones de subida', async () => {
    const body = {
      productId: 1,
      name: 'foto.jpg',
      type: 'image/jpeg',
      size: 1000,
    };

    const response = await POST(buildRequest(body), {
      params: Promise.resolve({}),
    });
    const result = (await response.json()) as { key: string };

    expect(response.status).toBe(200);
    expect(result.key).toBe('product-images/1/abc123.jpg');
    expect(mockedProductRepository.findById).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      false
    );
    expect(mockedValidateProductImage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'foto.jpg', type: 'image/jpeg', size: 1000 })
    );
  });

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAdmin.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await POST(buildRequest({}), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve 400 si el cuerpo es inválido', async () => {
    const response = await POST(
      buildRequest({ productId: 'abc', name: '', type: '', size: -1 }),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(400);
  });

  test('devuelve 404 si el producto no existe', async () => {
    mockedProductRepository.findById.mockResolvedValue(null);

    const response = await POST(
      buildRequest({ productId: 99, name: 'foto.jpg', type: 'image/jpeg', size: 1000 }),
      { params: Promise.resolve({}) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto no encontrado.');
  });
});
