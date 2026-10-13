import {
  PRODUCT_IMAGE_TARGET_WIDTH,
  PRODUCT_IMAGE_TARGET_HEIGHT,
  PRODUCT_IMAGE_WEBP_QUALITY,
  PRODUCT_IMAGE_JPEG_QUALITY,
  PRODUCT_IMAGE_MIN_SOURCE_LONG_EDGE_PX,
} from '@/config/product-images';

export interface NormalizedProductImage {
  file: File;
  width: number;
  height: number;
  mimeType: string;
  /** El original no era 16:9: se completó con márgenes para no recortarla. */
  marginsAdded: boolean;
  /** El original es chico: al estirarlo hasta el tamaño de salida puede verse borroso. */
  lowResolution: boolean;
}

const RATIO_TOLERANCE = 0.05;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/**
 * Decodifica el archivo respetando la orientación EXIF (fotos de celular).
 * Re-codificar la imagen además descarta todos los metadatos, incluido el GPS.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('No se pudo decodificar la imagen.'));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

/** Rectángulo destino para encuadrar la imagen completa (contain) en el lienzo. */
export function computeContainFit(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
): { dx: number; dy: number; width: number; height: number } {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return {
    dx: Math.round((targetWidth - width) / 2),
    dy: Math.round((targetHeight - height) / 2),
    width,
    height,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Normaliza la imagen elegida en el panel al formato de publicación del
 * catálogo: lienzo fijo 16:9, imagen completa con márgenes transparentes,
 * WebP con pérdida. Safari no exporta WebP desde canvas: en ese caso se
 * reintenta como JPEG sobre fondo blanco (o se acepta el PNG que devuelva).
 * La re-codificación descarta los metadatos del archivo original (GPS, cámara).
 */
export async function normalizeProductImageFile(
  file: File
): Promise<NormalizedProductImage> {
  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error('El archivo no se pudo decodificar como imagen.');
  }

  try {
    const { width: sourceWidth, height: sourceHeight } = decoded;
    if (sourceWidth < 1 || sourceHeight < 1) {
      throw new Error('La imagen no tiene dimensiones válidas.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = PRODUCT_IMAGE_TARGET_WIDTH;
    canvas.height = PRODUCT_IMAGE_TARGET_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('El navegador no pudo preparar el lienzo de la imagen.');
    }

    const fit = computeContainFit(
      sourceWidth,
      sourceHeight,
      canvas.width,
      canvas.height
    );
    ctx.drawImage(decoded.source, fit.dx, fit.dy, fit.width, fit.height);

    let blob = await canvasToBlob(
      canvas,
      'image/webp',
      PRODUCT_IMAGE_WEBP_QUALITY
    );
    if (!blob || blob.type !== 'image/webp') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(decoded.source, fit.dx, fit.dy, fit.width, fit.height);
      blob = await canvasToBlob(
        canvas,
        'image/jpeg',
        PRODUCT_IMAGE_JPEG_QUALITY
      );
    }
    if (!blob) {
      throw new Error('El navegador no pudo generar la imagen.');
    }

    const mimeType = blob.type || 'image/png';
    const extension = EXTENSION_BY_MIME[mimeType] ?? 'png';
    const baseName = file.name.replace(/\.[^.]+$/, '').trim() || 'imagen';
    const normalized = new File([blob], `${baseName}.${extension}`, {
      type: mimeType,
    });

    return {
      file: normalized,
      width: canvas.width,
      height: canvas.height,
      mimeType,
      marginsAdded:
        Math.abs(
          sourceWidth / sourceHeight -
            PRODUCT_IMAGE_TARGET_WIDTH / PRODUCT_IMAGE_TARGET_HEIGHT
        ) > RATIO_TOLERANCE,
      lowResolution:
        Math.max(sourceWidth, sourceHeight) < PRODUCT_IMAGE_MIN_SOURCE_LONG_EDGE_PX,
    };
  } finally {
    decoded.release();
  }
}
