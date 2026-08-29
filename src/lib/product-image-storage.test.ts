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
    test('devuelve imageUrl si no hay imageKey', () => {
      const product = {
        id: 1,
        imageUrl: 'https://example.com/imagen.jpg',
        imageKey: null,
      } as unknown as import('@/domain/types').ProductRow;

      expect(resolveProductImage(product)).toBe(
        'https://example.com/imagen.jpg'
      );
    });

    test('devuelve null si no hay imagen', () => {
      const product = {
        id: 1,
        imageUrl: null,
        imageKey: null,
      } as unknown as import('@/domain/types').ProductRow;

      expect(resolveProductImage(product)).toBeNull();
    });
  });
});
