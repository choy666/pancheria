/**
 * @jest-environment jsdom
 */
import {
  computeContainFit,
  normalizeProductImageFile,
} from './product-image-normalize';
import {
  PRODUCT_IMAGE_TARGET_WIDTH,
  PRODUCT_IMAGE_TARGET_HEIGHT,
} from '@/config/product-images';

const drawImage = jest.fn();
const fillRect = jest.fn();
const clearRect = jest.fn();

let blobTypeFor: (requested: string) => string | null = (type) => type;
let bitmap = { width: 1600, height: 900, close: jest.fn() };

function archivo(nombre = 'promo.png'): File {
  return new File(['bytes'], nombre, { type: 'image/png' });
}

beforeEach(() => {
  jest.clearAllMocks();
  blobTypeFor = (type) => type;
  bitmap = { width: 1600, height: 900, close: jest.fn() };

  (globalThis as unknown as { createImageBitmap: jest.Mock }).createImageBitmap =
    jest.fn().mockResolvedValue(bitmap);

  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({
      drawImage,
      fillRect,
      clearRect,
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D);

  jest
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation((callback, type) => {
      const resolved = blobTypeFor(type ?? 'image/png');
      callback(resolved ? new Blob(['x'], { type: resolved }) : null);
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
});

describe('computeContainFit', () => {
  test('una imagen 16:9 llena el lienzo sin márgenes', () => {
    expect(computeContainFit(1600, 900, 1200, 675)).toEqual({
      dx: 0,
      dy: 0,
      width: 1200,
      height: 675,
    });
  });

  test('una foto más apaisada deja márgenes arriba y abajo', () => {
    expect(computeContainFit(2400, 900, 1200, 675)).toEqual({
      dx: 0,
      dy: 113,
      width: 1200,
      height: 450,
    });
  });

  test('una foto vertical o cuadrada deja márgenes a los costados', () => {
    expect(computeContainFit(900, 1200, 1200, 675)).toEqual({
      dx: 347,
      dy: 0,
      width: 506,
      height: 675,
    });
  });

  test('una imagen chica se estira manteniendo la proporción', () => {
    const fit = computeContainFit(400, 300, 1200, 675);
    expect(fit).toEqual({ dx: 150, dy: 0, width: 900, height: 675 });
  });
});

describe('normalizeProductImageFile', () => {
  test('publica WebP 16:9 y cierra el bitmap decodificado', async () => {
    const result = await normalizeProductImageFile(archivo('promo.png'));

    expect(result.file.name).toBe('promo.webp');
    expect(result.file.type).toBe('image/webp');
    expect(result.width).toBe(PRODUCT_IMAGE_TARGET_WIDTH);
    expect(result.height).toBe(PRODUCT_IMAGE_TARGET_HEIGHT);
    expect(result.marginsAdded).toBe(false);
    expect(result.lowResolution).toBe(false);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1200, 675);
    expect(bitmap.close).toHaveBeenCalled();
  });

  test('marca márgenes cuando el original no es 16:9', async () => {
    bitmap = { width: 1200, height: 1200, close: jest.fn() };
    (globalThis.createImageBitmap as jest.Mock).mockResolvedValue(bitmap);

    const result = await normalizeProductImageFile(archivo());

    expect(result.marginsAdded).toBe(true);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 263, 0, 675, 675);
  });

  test('marca baja resolución cuando el lado mayor del original queda corto', async () => {
    bitmap = { width: 640, height: 360, close: jest.fn() };
    (globalThis.createImageBitmap as jest.Mock).mockResolvedValue(bitmap);

    const result = await normalizeProductImageFile(archivo());

    expect(result.lowResolution).toBe(true);
  });

  test('cae a JPEG sobre fondo blanco si el navegador no exporta WebP', async () => {
    blobTypeFor = (type) => (type === 'image/jpeg' ? 'image/jpeg' : 'image/png');

    const result = await normalizeProductImageFile(archivo('foto.png'));

    expect(result.file.name).toBe('foto.jpg');
    expect(result.mimeType).toBe('image/jpeg');
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1200, 675);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  test('rechaza un archivo que no decodifica como imagen', async () => {
    (globalThis.createImageBitmap as jest.Mock).mockRejectedValue(
      new Error('boom')
    );

    await expect(normalizeProductImageFile(archivo('roto.png'))).rejects.toThrow(
      'no se pudo decodificar'
    );
  });

  test('rechaza si el navegador no genera ningún blob', async () => {
    blobTypeFor = () => null;

    await expect(normalizeProductImageFile(archivo())).rejects.toThrow(
      'no pudo generar la imagen'
    );
  });
});
