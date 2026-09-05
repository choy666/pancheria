/**
 * @jest-environment node
 */
import { uploadProductImage } from './product-image-upload-client';
import { authenticatedFetch } from '@/lib/fetch';

jest.mock('@/lib/fetch', () => ({
  authenticatedFetch: jest.fn(),
}));

jest.mock('@vercel/blob/client', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://blob.vercel-storage.com/product-images/1/abc.jpg' }),
}));

const mockedAuthenticatedFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

describe('product-image-upload-client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createFile(name: string, type: string, content = 'imagen'): File {
    return new File([Buffer.from(content)], name, { type });
  }

  function prepareResponse(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  describe('preparación de la subida', () => {
    test('propaga el mensaje de error del servidor', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({ error: 'El tipo de imagen no está permitido.' }, 400)
      );

      const file = createFile('imagen.gif', 'image/gif');

      await expect(uploadProductImage(file, 1)).rejects.toThrow(
        'El tipo de imagen no está permitido.'
      );
    });

    test('falla si hay un error de red al preparar', async () => {
      mockedAuthenticatedFetch.mockRejectedValue(new Error('Network error'));

      const file = createFile('imagen.jpg', 'image/jpeg');

      await expect(uploadProductImage(file, 1)).rejects.toThrow('Network error');
    });
  });

  describe('subida a Vercel Blob', () => {
    test('sube el archivo directamente con el token cliente', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://blob.vercel-storage.com',
          method: 'POST',
          token: 'client-token',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      const { put } = await import('@vercel/blob/client');
      const file = createFile('imagen.jpg', 'image/jpeg');

      const result = await uploadProductImage(file, 1);

      expect(put).toHaveBeenCalledWith(
        'product-images/1/abc.jpg',
        file,
        expect.objectContaining({
          access: 'public',
          token: 'client-token',
        })
      );
      expect(result).toMatchObject({
        imageUrl: 'https://blob.vercel-storage.com/product-images/1/abc.jpg',
        imageKey: 'product-images/1/abc.jpg',
        imageMimeType: 'image/jpeg',
        imageSize: file.size,
      });
    });
  });

  describe('subida remota vía PUT', () => {
    test('sube el archivo y devuelve la URL pública configurada', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://s3.example.com/product-images/1/abc.jpg',
          method: 'PUT',
          key: 'product-images/1/abc.jpg',
          publicUrl: 'https://cdn.example.com/product-images/1/abc.jpg',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(new Response('', { status: 200 }));

      const file = createFile('imagen.jpg', 'image/jpeg');
      const result = await uploadProductImage(file, 1);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://s3.example.com/product-images/1/abc.jpg',
        expect.objectContaining({
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );
      expect(result.imageUrl).toBe('https://cdn.example.com/product-images/1/abc.jpg');
    });

    test('usa la URL de destino como fallback si no hay publicUrl', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://s3.example.com/product-images/1/abc.jpg',
          method: 'PUT',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(new Response('', { status: 200 }));

      const file = createFile('imagen.jpg', 'image/jpeg');
      const result = await uploadProductImage(file, 1);

      expect(result.imageUrl).toBe('https://s3.example.com/product-images/1/abc.jpg');
    });

    test('lanza error cuando la respuesta de PUT no es exitosa', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://s3.example.com/product-images/1/abc.jpg',
          method: 'PUT',
          key: 'product-images/1/abc.jpg',
          publicUrl: 'https://cdn.example.com/product-images/1/abc.jpg',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(new Response('Forbidden', { status: 403, statusText: 'Forbidden' }));

      const file = createFile('imagen.jpg', 'image/jpeg');

      await expect(uploadProductImage(file, 1)).rejects.toThrow('Error al subir la imagen: 403 Forbidden');
    });

    test('propaga errores de red durante el PUT', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://s3.example.com/product-images/1/abc.jpg',
          method: 'PUT',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      (global.fetch as jest.Mock).mockRejectedValue(new Error('fetch failed'));

      const file = createFile('imagen.jpg', 'image/jpeg');

      await expect(uploadProductImage(file, 1)).rejects.toThrow('fetch failed');
    });
  });

  describe('subida remota vía POST', () => {
    test('envía un FormData con los campos y el archivo', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://example.com/upload',
          method: 'POST',
          fields: {
            key: 'product-images/1/abc.jpg',
            filename: 'imagen.jpg',
            mimeType: 'image/jpeg',
          },
          key: 'product-images/1/abc.jpg',
          publicUrl: 'https://cdn.example.com/product-images/1/abc.jpg',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(new Response('', { status: 200 }));

      const file = createFile('imagen.jpg', 'image/jpeg');
      await uploadProductImage(file, 1);

      const [calledUrl, calledInit] = (global.fetch as jest.Mock).mock.calls[0] as [string, { body: FormData }];
      expect(calledUrl).toBe('https://example.com/upload');

      const formData = calledInit.body;
      expect(formData.get('key')).toBe('product-images/1/abc.jpg');
      expect(formData.get('filename')).toBe('imagen.jpg');
      expect(formData.get('mimeType')).toBe('image/jpeg');
      expect(formData.get('file')).toBe(file);
    });

    test('extrae la URL pública del cuerpo JSON cuando no hay publicUrl', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://example.com/upload',
          method: 'POST',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify({ url: 'https://cdn.example.com/image.jpg' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const file = createFile('imagen.jpg', 'image/jpeg');
      const result = await uploadProductImage(file, 1);

      expect(result.imageUrl).toBe('https://cdn.example.com/image.jpg');
    });

    test('usa el header Location como URL pública cuando no hay cuerpo JSON', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://example.com/upload',
          method: 'POST',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(
        new Response('', {
          status: 201,
          headers: { Location: 'https://cdn.example.com/image.jpg' },
        })
      );

      const file = createFile('imagen.jpg', 'image/jpeg');
      const result = await uploadProductImage(file, 1);

      expect(result.imageUrl).toBe('https://cdn.example.com/image.jpg');
    });

    test('lanza error si no se puede determinar la URL pública', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://example.com/upload',
          method: 'POST',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(new Response('', { status: 200 }));

      const file = createFile('imagen.jpg', 'image/jpeg');

      await expect(uploadProductImage(file, 1)).rejects.toThrow(
        'No se pudo obtener la URL pública de la imagen.'
      );
    });

    test('lanza error cuando la respuesta de POST no es exitosa', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://example.com/upload',
          method: 'POST',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      (global.fetch as jest.Mock).mockResolvedValue(new Response('Bad Request', { status: 400, statusText: 'Bad Request' }));

      const file = createFile('imagen.jpg', 'image/jpeg');

      await expect(uploadProductImage(file, 1)).rejects.toThrow('Error al subir la imagen: 400 Bad Request');
    });

    test('propaga errores de red durante el POST', async () => {
      mockedAuthenticatedFetch.mockResolvedValue(
        prepareResponse({
          url: 'https://example.com/upload',
          method: 'POST',
          key: 'product-images/1/abc.jpg',
          publicUrl: '',
        })
      );

      (global.fetch as jest.Mock).mockRejectedValue(new Error('connection refused'));

      const file = createFile('imagen.jpg', 'image/jpeg');

      await expect(uploadProductImage(file, 1)).rejects.toThrow('connection refused');
    });
  });
});
