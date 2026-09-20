/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { db } from '@/db';
import * as productImageStorage from '@/lib/product-image-storage';
import * as catalog from '@/lib/catalog';

jest.mock('@/lib/product-image-storage');
jest.mock('@/lib/catalog', () => ({
  isPublicSellableProduct: jest.fn(),
}));
jest.mock('@/db', () => ({
  db: {
    query: {
      products: { findFirst: jest.fn() },
    },
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

const mockedDb = db as unknown as {
  query: {
    products: { findFirst: jest.Mock };
  };
};
const mockedReadProductImage = productImageStorage.readProductImage as jest.MockedFunction<
  typeof productImageStorage.readProductImage
>;
const mockedIsPublicSellableProduct = catalog.isPublicSellableProduct as jest.MockedFunction<
  typeof catalog.isPublicSellableProduct
>;

function buildRequest(key: string, branchId?: string): NextRequest {
  const query = branchId ? `?branchId=${branchId}` : '';
  return new NextRequest(
    `http://localhost:3000/api/productos/imagen/${encodeURIComponent(key)}${query}`
  );
}

describe('GET /api/productos/imagen/[key]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsPublicSellableProduct.mockReturnValue(true);
  });

  test('devuelve la imagen con cache pública', async () => {
    const key = 'product-images/1/abc123.jpg';
    mockedDb.query.products.findFirst.mockResolvedValue({
      id: 1,
      imageKey: key,
    });
    mockedReadProductImage.mockResolvedValue({
      buffer: Buffer.from('imagen'),
      mimeType: 'image/jpeg',
    });

    const response = await GET(buildRequest(key, '1'), {
      params: Promise.resolve({ key }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(mockedReadProductImage).toHaveBeenCalledWith(key);
  });

  test('devuelve 400 si la clave no tiene un productId válido', async () => {
    const response = await GET(buildRequest('invalid', '1'), {
      params: Promise.resolve({ key: 'invalid' }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Clave de imagen inválida.');
  });

  test('devuelve 400 si falta el branchId', async () => {
    const key = 'product-images/1/abc123.jpg';

    const response = await GET(buildRequest(key), {
      params: Promise.resolve({ key }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('Falta el parámetro branchId.');
    expect(mockedDb.query.products.findFirst).not.toHaveBeenCalled();
  });

  test('devuelve 400 si el branchId es inválido', async () => {
    const key = 'product-images/1/abc123.jpg';

    const response = await GET(buildRequest(key, 'abc'), {
      params: Promise.resolve({ key }),
    });

    expect(response.status).toBe(400);
    expect(mockedDb.query.products.findFirst).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el producto pertenece a otra sucursal', async () => {
    const key = 'product-images/1/abc123.jpg';
    // El repositorio filtra por branchId: para la sucursal pedida no hay
    // producto con esa clave y se responde como si no existiera.
    mockedDb.query.products.findFirst.mockResolvedValue(null);

    const response = await GET(buildRequest(key, '2'), {
      params: Promise.resolve({ key }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Imagen no encontrada.');
  });

  test('devuelve 404 si el producto no es público vendible', async () => {
    const key = 'product-images/1/abc123.jpg';
    mockedDb.query.products.findFirst.mockResolvedValue({ id: 1 });
    mockedIsPublicSellableProduct.mockReturnValue(false);

    const response = await GET(buildRequest(key, '1'), {
      params: Promise.resolve({ key }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Imagen no encontrada.');
  });

  test('devuelve 404 si no se encuentra el archivo', async () => {
    const key = 'product-images/1/abc123.jpg';
    mockedDb.query.products.findFirst.mockResolvedValue({
      id: 1,
      imageKey: key,
    });
    mockedReadProductImage.mockResolvedValue(null);

    const response = await GET(buildRequest(key, '1'), {
      params: Promise.resolve({ key }),
    });
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('Archivo de imagen no encontrado.');
  });
});
