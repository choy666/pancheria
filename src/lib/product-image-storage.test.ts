/**
 * @jest-environment node
 */

import {
  validateProductImageUrl,
  validateProductImage,
  isValidProductImageKey,
  resolveProductImage,
} from '@/lib/product-image-storage';
import { ValidationError } from '@/domain/errors';

describe('product-image-storage', () => {
  describe('validateProductImageUrl', () => {
    test('acepta URLs HTTPS válidas', () => {
      expect(() =>
        validateProductImageUrl('https://example.com/imagen.jpg')
      ).not.toThrow();
    });

    test('rechaza URLs HTTP', () => {
      expect(() =>
        validateProductImageUrl('http://example.com/imagen.jpg')
      ).toThrow(ValidationError);
    });

    test('rechaza esquemas inseguros', () => {
      expect(() =>
        validateProductImageUrl('javascript:alert(1)')
      ).toThrow(ValidationError);
      expect(() =>
        validateProductImageUrl('data:text/html,foo')
      ).toThrow(ValidationError);
    });

    test('rechaza URLs que superan la longitud máxima', () => {
      const longUrl = `https://example.com/${'a'.repeat(2048)}`;
      expect(() => validateProductImageUrl(longUrl)).toThrow(ValidationError);
    });
  });

  describe('validateProductImage', () => {
    test('acepta imágenes permitidas', () => {
      expect(() =>
        validateProductImage({
          name: 'imagen.jpg',
          type: 'image/jpeg',
          size: 1024,
        })
      ).not.toThrow();
    });

    test('rechaza tipos MIME no permitidos', () => {
      expect(() =>
        validateProductImage({
          name: 'imagen.gif',
          type: 'image/gif',
          size: 1024,
        })
      ).toThrow(ValidationError);
    });

    test('rechaza archivos que superan el tamaño máximo', () => {
      expect(() =>
        validateProductImage({
          name: 'imagen.jpg',
          type: 'image/jpeg',
          size: 10 * 1024 * 1024 * 1024,
        })
      ).toThrow(ValidationError);
    });
  });

  describe('isValidProductImageKey', () => {
    test('acepta claves válidas', () => {
      expect(
        isValidProductImageKey('product-images/123/abc123.jpg')
      ).toBe(true);
    });

    test('rechaza claves con path traversal', () => {
      expect(
        isValidProductImageKey('product-images/123/../otro.jpg')
      ).toBe(false);
    });

    test('rechaza claves vacías', () => {
      expect(isValidProductImageKey('')).toBe(false);
    });
  });

  describe('resolveProductImage', () => {
    const OLD_DOMAINS = process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS;
    const OLD_PROVIDER = process.env.STORAGE_PROVIDER;
    const OLD_BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

    afterEach(() => {
      if (OLD_DOMAINS === undefined) {
        delete process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS;
      } else {
        process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS = OLD_DOMAINS;
      }
      if (OLD_PROVIDER === undefined) {
        delete process.env.STORAGE_PROVIDER;
      } else {
        process.env.STORAGE_PROVIDER = OLD_PROVIDER;
      }
      if (OLD_BLOB_TOKEN === undefined) {
        delete process.env.BLOB_READ_WRITE_TOKEN;
      } else {
        process.env.BLOB_READ_WRITE_TOKEN = OLD_BLOB_TOKEN;
      }
    });

    test('devuelve imageUrl si no hay imageKey y el dominio es servible por next/image', () => {
      process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS = 'example.com';
      const product = {
        id: 1,
        imageUrl: 'https://example.com/imagen.jpg',
        imageKey: null,
      } as unknown as import('@/domain/types').ProductRow;

      expect(resolveProductImage(product)).toBe(
        'https://example.com/imagen.jpg'
      );
    });

    test('omite imageUrl de dominio no servible para no romper el catálogo', () => {
      process.env.PRODUCT_IMAGE_ALLOWED_EXTERNAL_DOMAINS = 'otro-dominio.com';
      const product = {
        id: 1,
        imageUrl: 'https://example.com/imagen.jpg',
        imageKey: null,
      } as unknown as import('@/domain/types').ProductRow;

      expect(resolveProductImage(product)).toBeNull();
    });

    test('devuelve null si no hay imagen', () => {
      const product = {
        id: 1,
        imageUrl: null,
        imageKey: null,
      } as unknown as import('@/domain/types').ProductRow;

      expect(resolveProductImage(product)).toBeNull();
    });

    test('con provider local devuelve la ruta relativa con branchId', () => {
      delete process.env.STORAGE_PROVIDER;
      const product = {
        id: 1,
        branchId: 3,
        imageUrl: null,
        imageKey: 'product-images/1/abc123.jpg',
      } as unknown as import('@/domain/types').ProductRow;

      const url = resolveProductImage(product);

      expect(url).toBe(
        '/api/productos/imagen/product-images%2F1%2Fabc123.jpg?branchId=3'
      );
    });

    test('con vercel-blob y imageKey devuelve la image_url persistida', () => {
      process.env.STORAGE_PROVIDER = 'vercel-blob';
      const product = {
        id: 1,
        branchId: 3,
        imageUrl:
          'https://storeid.public.blob.vercel-storage.com/product-images/1/abc123.jpg',
        imageKey: 'product-images/1/abc123.jpg',
      } as unknown as import('@/domain/types').ProductRow;

      // Sin BLOB_READ_WRITE_TOKEN el origen no entra en remotePatterns: se
      // omite en vez de romper el render del catálogo.
      expect(resolveProductImage(product)).toBeNull();

      process.env.BLOB_READ_WRITE_TOKEN = 'token-de-prueba';
      expect(resolveProductImage(product)).toBe(
        'https://storeid.public.blob.vercel-storage.com/product-images/1/abc123.jpg'
      );
      delete process.env.BLOB_READ_WRITE_TOKEN;
    });
  });
});
