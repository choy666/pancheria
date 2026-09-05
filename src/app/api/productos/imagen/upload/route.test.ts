/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from './route';
import * as productRepository from '@/repositories/productRepository';
import * as productImageStorage from '@/lib/product-image-storage';
import * as videoConfig from '@/config/videos';
import { requireAdmin, getCurrentBranchId } from '@/lib/auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/repositories/productRepository');
jest.mock('@/lib/product-image-storage');
jest.mock('@/config/videos', () => ({
  getStorageProvider: jest.fn(),
}));
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
const mockedSaveProductImage = productImageStorage.saveProductImage as jest.MockedFunction<
  typeof productImageStorage.saveProductImage
>;
const mockedGetStorageProvider = videoConfig.getStorageProvider as jest.MockedFunction<
  typeof videoConfig.getStorageProvider
>;
const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedGetCurrentBranchId = getCurrentBranchId as jest.MockedFunction<
  typeof getCurrentBranchId
>;

const BRANCH_ID = 1;

function buildRequest(formData: FormData): NextRequest {
  return new NextRequest('http://localhost:3000/api/productos/imagen/upload', {
    method: 'POST',
    body: formData,
  });
}

function createFormData(key: string, file?: File): FormData {
  const formData = new FormData();
  formData.append('key', key);
  if (file) {
    formData.append('file', file);
  }
  return formData;
}

describe('POST /api/productos/imagen/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const session = {
      user: { name: 'admin', role: 'admin', branchId: BRANCH_ID },
    } as Awaited<ReturnType<typeof requireAdmin>>;
    mockedRequireAdmin.mockResolvedValue(session);
    mockedGetCurrentBranchId.mockResolvedValue(BRANCH_ID);
    mockedGetStorageProvider.mockReturnValue('local');
    mockedProductRepository.findById.mockResolvedValue({
      id: 1,
      name: 'Producto',
    } as any);
    mockedSaveProductImage.mockResolvedValue({
      key: 'product-images/1/abc123.jpg',
      publicUrl: 'http://localhost:3000/api/productos/imagen/abc123',
      mimeType: 'image/jpeg',
      size: 1000,
    } as any);
  });

  test('guarda la imagen en modo local y devuelve 201', async () => {
    const file = new File(['imagen'], 'foto.jpg', { type: 'image/jpeg' });
    const formData = createFormData('product-images/1/abc123.jpg', file);

    const response = await POST(buildRequest(formData), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as { key: string };

    expect(response.status).toBe(200);
    expect(body.key).toBe('product-images/1/abc123.jpg');
    expect(mockedProductRepository.findById).toHaveBeenCalledWith(
      BRANCH_ID,
      1,
      false
    );
    expect(mockedSaveProductImage).toHaveBeenCalledWith(
      file,
      1,
      'product-images/1/abc123.jpg'
    );
  });

  test('devuelve 401 cuando el usuario no está autenticado', async () => {
    mockedRequireAdmin.mockRejectedValue(
      new UnauthorizedError('Se requiere iniciar sesión.')
    );

    const response = await POST(buildRequest(createFormData('x')), {
      params: Promise.resolve({}),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('Se requiere iniciar sesión.');
  });

  test('devuelve 400 si el proveedor no es local', async () => {
    mockedGetStorageProvider.mockReturnValue('vercel-blob');

    const response = await POST(
      buildRequest(createFormData('x', new File(['x'], 'x.jpg'))),
      { params: Promise.resolve({}) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('La subida directa solo está disponible en modo local.');
  });

  test('devuelve 400 si faltan la clave o el archivo', async () => {
    const response = await POST(buildRequest(new FormData()), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
  });

  test('devuelve 400 si la clave no contiene un producto válido', async () => {
    const response = await POST(
      buildRequest(
        createFormData('product-images/abc/foto.jpg', new File(['x'], 'x.jpg'))
      ),
      { params: Promise.resolve({}) }
    );

    expect(response.status).toBe(400);
  });

  test('devuelve 404 si el producto no existe', async () => {
    mockedProductRepository.findById.mockResolvedValue(null);

    const response = await POST(
      buildRequest(
        createFormData('product-images/99/foto.jpg', new File(['x'], 'x.jpg'))
      ),
      { params: Promise.resolve({}) }
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Producto no encontrado.');
  });
});
