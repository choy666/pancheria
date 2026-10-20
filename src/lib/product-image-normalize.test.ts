/**
 * @jest-environment jsdom
 */
import {
  computeContainFit,
  findContentBounds,
  normalizeProductImageFile,
} from './product-image-normalize';
import {
  PRODUCT_IMAGE_TARGET_WIDTH,
  PRODUCT_IMAGE_TARGET_HEIGHT,
} from '@/config/product-images';

const drawImage = jest.fn();
const fillRect = jest.fn();
const clearRect = jest.fn();
const getImageData = jest.fn();

let blobTypeFor: (requested: string) => string | null = (type) => type;
let bitmap = { width: 1600, height: 900, close: jest.fn() };

/** Lienzo RGBA uniforme: todo blanco opaco (sin contenido detectable). */
function lienzoBlanco(width: number, height: number): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4).fill(255),
    width,
    height,
  } as ImageData;
}

function archivo(nombre = 'promo.png'): File {
  return new File(['bytes'], nombre, { type: 'image/png' });
}

beforeEach(() => {
  jest.clearAllMocks();
  blobTypeFor = (type) => type;
  bitmap = { width: 1600, height: 900, close: jest.fn() };

  getImageData.mockImplementation((_x, _y, w: number, h: number) =>
    lienzoBlanco(w, h)
  );

  (globalThis as unknown as { createImageBitmap: jest.Mock }).createImageBitmap =
    jest.fn().mockResolvedValue(bitmap);

  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({
      drawImage,
      fillRect,
      clearRect,
      getImageData,
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
    expect(drawImage).toHaveBeenLastCalledWith(
      bitmap,
      0,
      0,
      1600,
      900,
      0,
      0,
      1200,
      675
    );
    expect(bitmap.close).toHaveBeenCalled();
  });

  test('marca márgenes cuando el original no es 16:9', async () => {
    bitmap = { width: 1200, height: 1200, close: jest.fn() };
    (globalThis.createImageBitmap as jest.Mock).mockResolvedValue(bitmap);

    const result = await normalizeProductImageFile(archivo());

    expect(result.marginsAdded).toBe(true);
    expect(drawImage).toHaveBeenLastCalledWith(
      bitmap,
      0,
      0,
      1200,
      1200,
      263,
      0,
      675,
      675
    );
  });

  test('recorta el aire uniforme alrededor del producto antes de encuadrar', async () => {
    bitmap = { width: 1000, height: 1000, close: jest.fn() };
    (globalThis.createImageBitmap as jest.Mock).mockResolvedValue(bitmap);
    // Escaneo a 800×800 (scale 0.8): cuadrado oscuro centrado en 160..639.
    getImageData.mockImplementation((_x, _y, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4).fill(255);
      for (let py = 160; py < 640; py += 1) {
        for (let px = 160; px < 640; px += 1) {
          const i = (py * w + px) * 4;
          data[i] = 20;
          data[i + 1] = 20;
          data[i + 2] = 20;
        }
      }
      return { data, width: w, height: h } as ImageData;
    });

    const result = await normalizeProductImageFile(archivo());

    // bounds 480×480 en (160,160); pad 28.8 e inv 1.25 → frame 672×672 en
    // (164,164), y containFit de un cuadrado en 16:9 centra a dx=263.
    expect(drawImage).toHaveBeenLastCalledWith(
      bitmap,
      164,
      164,
      672,
      672,
      263,
      0,
      675,
      675
    );
    expect(result.marginsAdded).toBe(true);
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
    // 1 dibujo en el lienzo de escaneo + 2 en el final (WebP fallido y JPEG).
    expect(drawImage).toHaveBeenCalledTimes(3);
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

describe('findContentBounds', () => {
  const W = 6;
  const H = 6;

  function pintar(data: Uint8ClampedArray, x: number, y: number, rgb = 20) {
    const i = (y * W + x) * 4;
    data[i] = rgb;
    data[i + 1] = rgb;
    data[i + 2] = rgb;
    data[i + 3] = 255;
  }

  test('detecta el rectángulo de contenido sobre fondo blanco', () => {
    const { data } = lienzoBlanco(W, H);
    for (const [x, y] of [
      [2, 1],
      [3, 1],
      [4, 1],
      [2, 2],
      [3, 2],
      [4, 2],
    ]) {
      pintar(data, x, y);
    }

    expect(findContentBounds(data, W, H)).toEqual({
      x: 2,
      y: 1,
      width: 3,
      height: 2,
    });
  });

  test('el aire transparente no cuenta como contenido', () => {
    const data = new Uint8ClampedArray(W * H * 4); // todo alpha 0
    pintar(data, 4, 5, 200);

    expect(findContentBounds(data, W, H)).toEqual({
      x: 4,
      y: 5,
      width: 1,
      height: 1,
    });
  });

  test('devuelve null cuando el lienzo es uniforme o vacío', () => {
    expect(findContentBounds(lienzoBlanco(W, H).data, W, H)).toBeNull();
    expect(
      findContentBounds(new Uint8ClampedArray(W * H * 4), W, H)
    ).toBeNull();
  });

  test('una sombra suave dentro de la tolerancia no extiende el bounding box', () => {
    const { data } = lienzoBlanco(W, H);
    pintar(data, 3, 3);
    // Sombra casi blanca (240) alrededor: no supera la tolerancia de 30.
    const sombra = (x: number, y: number) => {
      const i = (y * W + x) * 4;
      data[i] = 240;
      data[i + 1] = 240;
      data[i + 2] = 240;
    };
    sombra(2, 3);
    sombra(4, 3);
    sombra(3, 2);
    sombra(3, 4);

    expect(findContentBounds(data, W, H)).toEqual({
      x: 3,
      y: 3,
      width: 1,
      height: 1,
    });
  });
});
