import { BRAND_LOGO_MAX_BYTES, BRAND_LOGO_MAX_SIDE_PX } from '@/config/brand';

export function getLogoTargetSize(
  width: number,
  height: number,
  maxSide: number = BRAND_LOGO_MAX_SIDE_PX
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

/**
 * Reduce el logo a `BRAND_LOGO_MAX_SIDE_PX` manteniendo la proporción y lo
 * exporta como PNG (conserva transparencia). Si no entra en
 * `BRAND_LOGO_MAX_BYTES` prueba WebP; si tampoco, pide otra imagen. Un
 * navegador que no exporta WebP devuelve PNG y se descarta esa variante.
 */
export async function normalizeBrandLogoFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('No se pudo leer la imagen. Probá con un PNG, JPG o WebP.');
  });

  try {
    const { width, height } = getLogoTargetSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('El navegador no permite procesar la imagen.');
    }
    context.drawImage(bitmap, 0, 0, width, height);

    const png = await canvasToBlob(canvas, 'image/png');
    if (png && png.type === 'image/png' && png.size <= BRAND_LOGO_MAX_BYTES) {
      return new File([png], 'logo.png', { type: 'image/png' });
    }

    const webp = await canvasToBlob(canvas, 'image/webp', 0.9);
    if (webp && webp.type === 'image/webp' && webp.size <= BRAND_LOGO_MAX_BYTES) {
      return new File([webp], 'logo.webp', { type: 'image/webp' });
    }

    throw new Error(
      `El logo sigue superando ${BRAND_LOGO_MAX_BYTES / 1024} KB. Usá una imagen más simple.`
    );
  } finally {
    bitmap.close();
  }
}
