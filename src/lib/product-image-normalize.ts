import {
  PRODUCT_IMAGE_TARGET_WIDTH,
  PRODUCT_IMAGE_TARGET_HEIGHT,
  PRODUCT_IMAGE_WEBP_QUALITY,
  PRODUCT_IMAGE_JPEG_QUALITY,
  PRODUCT_IMAGE_MIN_SOURCE_LONG_EDGE_PX,
  PRODUCT_IMAGE_BACKGROUND,
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

// Recorte de "aire" uniforme: el escaneo se hace sobre una copia reducida
// para no recorrer megapíxeles en el navegador.
const TRIM_SCAN_MAX_EDGE = 800;
const TRIM_ALPHA_MIN = 128;
const TRIM_COLOR_TOLERANCE = 30;
// Aire generoso alrededor del contenido: el producto no toca los bordes del
// lienzo y la composición se siente más espaciada en la card.
const TRIM_PAD_RATIO = 0.1;
// Si el recorte no gana al menos esta fracción de área, no vale la pena.
const TRIM_MIN_GAIN_RATIO = 0.03;

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

interface ContentFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Bounding box del contenido sobre un fondo uniforme. El fondo se estima
 * desde las esquinas: si la mayoría es transparente el aire es alpha; si no,
 * el color promedio de esquina con tolerancia por canal. Devuelve null
 * cuando el lienzo es uniforme o no hay píxeles visibles.
 */
export function findContentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number
): ContentFrame | null {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  let transparentCorners = 0;
  let br = 0;
  let bg = 0;
  let bb = 0;
  let opaqueCorners = 0;
  for (const corner of corners) {
    const i = corner * 4;
    if (data[i + 3] < TRIM_ALPHA_MIN) {
      transparentCorners += 1;
    } else {
      br += data[i];
      bg += data[i + 1];
      bb += data[i + 2];
      opaqueCorners += 1;
    }
  }
  const transparentBg = transparentCorners > corners.length / 2;
  if (opaqueCorners > 0) {
    br /= opaqueCorners;
    bg /= opaqueCorners;
    bb /= opaqueCorners;
  }

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < TRIM_ALPHA_MIN) continue;
      if (!transparentBg) {
        const diff = Math.max(
          Math.abs(data[i] - br),
          Math.abs(data[i + 1] - bg),
          Math.abs(data[i + 2] - bb)
        );
        if (diff <= TRIM_COLOR_TOLERANCE) continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Encuadre del contenido dentro del original: recorta el aire uniforme del
 * fondo para que el producto ocupe una fracción parecida del lienzo entre
 * imágenes que traen márgenes internos distintos. Devuelve null cuando el
 * fondo no es uniforme o el recorte apenas gana área (foto real full-bleed).
 */
function detectContentFrame(decoded: DecodedImage): ContentFrame | null {
  const { width: sourceWidth, height: sourceHeight } = decoded;
  const scale = Math.min(
    1,
    TRIM_SCAN_MAX_EDGE / Math.max(sourceWidth, sourceHeight)
  );
  const scanWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scanHeight = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = scanWidth;
  canvas.height = scanHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(decoded.source, 0, 0, scanWidth, scanHeight);
    const bounds = findContentBounds(
      ctx.getImageData(0, 0, scanWidth, scanHeight).data,
      scanWidth,
      scanHeight
    );
    if (!bounds) return null;

    const inv = 1 / scale;
    const pad = Math.max(bounds.width, bounds.height) * TRIM_PAD_RATIO;
    const x = Math.max(0, Math.floor((bounds.x - pad) * inv));
    const y = Math.max(0, Math.floor((bounds.y - pad) * inv));
    const x2 = Math.min(
      sourceWidth,
      Math.ceil((bounds.x + bounds.width + pad) * inv)
    );
    const y2 = Math.min(
      sourceHeight,
      Math.ceil((bounds.y + bounds.height + pad) * inv)
    );
    const frame = { x, y, width: x2 - x, height: y2 - y };

    const gain = 1 - (frame.width * frame.height) / (sourceWidth * sourceHeight);
    return gain >= TRIM_MIN_GAIN_RATIO ? frame : null;
  } catch {
    // getImageData puede lanzar (lienzo tainted o sin soporte): en ese caso
    // se conserva el encuadre completo.
    return null;
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
 * catálogo: primero recorta el aire uniforme del fondo (bounding box del
 * contenido) para que el producto llene el lienzo parejo entre imágenes, y
 * después encuadra en lienzo fijo 16:9 sobre fondo blanco opaco, WebP con
 * pérdida. El fondo uniforme es parte del contrato visual del catálogo: cada
 * imagen comparte el mismo escenario y el gradiente de marca queda reservado
 * para productos sin foto. Safari no exporta WebP desde canvas: en ese caso
 * se reintenta como JPEG (o se acepta el PNG que devuelva). La
 * re-codificación descarta los metadatos del archivo original (GPS, cámara).
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

    const frame = detectContentFrame(decoded) ?? {
      x: 0,
      y: 0,
      width: sourceWidth,
      height: sourceHeight,
    };

    const canvas = document.createElement('canvas');
    canvas.width = PRODUCT_IMAGE_TARGET_WIDTH;
    canvas.height = PRODUCT_IMAGE_TARGET_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('El navegador no pudo preparar el lienzo de la imagen.');
    }

    const fit = computeContainFit(
      frame.width,
      frame.height,
      canvas.width,
      canvas.height
    );
    // Escenario uniforme: el lienzo sale siempre opaco para que el aire del
    // producto se vea igual en cualquier card (un fondo transparente dejaba
    // ver el gradiente de marca y cada imagen quedaba con un patrón distinto).
    ctx.fillStyle = PRODUCT_IMAGE_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      decoded.source,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      fit.dx,
      fit.dy,
      fit.width,
      fit.height
    );

    let blob = await canvasToBlob(
      canvas,
      'image/webp',
      PRODUCT_IMAGE_WEBP_QUALITY
    );
    if (!blob || blob.type !== 'image/webp') {
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
          frame.width / frame.height -
            PRODUCT_IMAGE_TARGET_WIDTH / PRODUCT_IMAGE_TARGET_HEIGHT
        ) > RATIO_TOLERANCE,
      lowResolution:
        Math.max(sourceWidth, sourceHeight) < PRODUCT_IMAGE_MIN_SOURCE_LONG_EDGE_PX,
    };
  } finally {
    decoded.release();
  }
}
