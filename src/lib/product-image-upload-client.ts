import { ApiError, authenticatedFetch, throwApiError } from '@/lib/fetch';
import { PRODUCTOS_API, PRODUCTOS_IMAGEN_PREPARAR_API } from '@/config/api';

interface ProductImageUploadInstructions {
  url: string;
  method: 'POST' | 'PUT';
  fields?: Record<string, string>;
  token?: string;
  key: string;
  publicUrl: string;
}

export interface ProductImageUploadResult {
  imageUrl: string;
  imageKey: string | null;
  imageMimeType: string;
  imageSize: number;
}

export type ProductImageValue =
  | { source: 'none' }
  | { source: 'upload'; file: File; previewUrl: string }
  | { source: 'url'; imageUrl: string }
  | {
      source: 'stored';
      imageUrl: string;
      imageKey: string | null;
      imageMimeType: string | null;
      imageSize: number | null;
    };

interface ProductImageFields {
  imageUrl?: string | null;
  imageKey?: string | null;
  imageMimeType?: string | null;
  imageSize?: number | null;
}

/** Imagen que ya tiene el producto. Sin `imageUrl` no hay imagen guardada. */
export function storedProductImage(product?: ProductImageFields): ProductImageValue {
  if (!product?.imageUrl) return { source: 'none' };

  return {
    source: 'stored',
    imageUrl: product.imageUrl,
    imageKey: product.imageKey ?? null,
    imageMimeType: product.imageMimeType ?? null,
    imageSize: product.imageSize ?? null,
  };
}

/**
 * Campos de imagen del POST/PUT del producto. `url` y `none` (quitar) viajan
 * en ese mismo request. `upload` necesita el id del producto para armar la
 * key, así que se adjunta después con `persistProductImageUpload`.
 */
export function toProductImagePayload(image: ProductImageValue): ProductImageFields {
  switch (image.source) {
    case 'none':
      return { imageUrl: null, imageKey: null, imageMimeType: null, imageSize: null };
    case 'url':
      return { imageUrl: image.imageUrl, imageKey: null, imageMimeType: null, imageSize: null };
    default:
      // stored: sin cambios, conserva la imagen actual. upload: se adjunta después.
      return {};
  }
}

/**
 * Imagen a persistir al guardar. Con la sección oculta (producto no vendible
 * al público) un archivo o URL pendiente se descarta y la imagen guardada no
 * se toca; quitar la imagen sí se aplica.
 */
export function imageToPersist(
  image: ProductImageValue,
  visible: boolean
): ProductImageValue | null {
  return visible || image.source === 'none' ? image : null;
}

async function prepareProductImageUpload(
  file: File,
  productId: number
): Promise<ProductImageUploadInstructions> {
  const response = await authenticatedFetch(
    PRODUCTOS_IMAGEN_PREPARAR_API,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId,
        name: file.name,
        type: file.type,
        size: file.size,
      }),
    }
  );

  if (!response.ok) {
    await throwApiError(response, 'Error al preparar la subida de la imagen.');
  }

  return (await response.json()) as ProductImageUploadInstructions;
}

export async function uploadProductImage(
  file: File,
  productId: number
): Promise<ProductImageUploadResult> {
  const instructions = await prepareProductImageUpload(file, productId);

  if (instructions.token) {
    const client = await import('@vercel/blob/client');
    const blob = await client.put(instructions.key, file, {
      access: 'public',
      token: instructions.token,
    });

    return {
      imageUrl: blob.url,
      imageKey: instructions.key,
      imageMimeType: file.type,
      imageSize: file.size,
    };
  }

  if (instructions.method === 'PUT') {
    const response = await fetch(instructions.url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!response.ok) {
      await throwApiError(
        response,
        `Error al subir la imagen: ${response.status} ${response.statusText}`
      );
    }

    return {
      imageUrl: instructions.publicUrl || instructions.url,
      imageKey: instructions.key,
      imageMimeType: file.type,
      imageSize: file.size,
    };
  }

  const formData = new FormData();
  if (instructions.fields) {
    Object.entries(instructions.fields).forEach(([k, v]) => {
      formData.append(k, v);
    });
  }
  formData.append('file', file);

  const response = await fetch(instructions.url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    await throwApiError(
      response,
      `Error al subir la imagen: ${response.status} ${response.statusText}`
    );
  }

  let imageUrl = instructions.publicUrl;
  if (!imageUrl) {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = (await response.json()) as { url?: string };
      if (data.url) imageUrl = data.url;
    }
  }

  if (!imageUrl) {
    const location = response.headers.get('Location');
    if (location) imageUrl = location;
  }

  if (!imageUrl) {
    throw new ApiError('No se pudo obtener la URL pública de la imagen.', 502);
  }

  return {
    imageUrl,
    imageKey: instructions.key,
    imageMimeType: file.type,
    imageSize: file.size,
  };
}

/**
 * Sube el archivo y adjunta la imagen resultante al producto ya creado. Es el
 * único caso de dos pasos: la key de la imagen depende del id del producto.
 */
export async function persistProductImageUpload(
  productId: number,
  file: File
): Promise<void> {
  const saved = await uploadProductImage(file, productId);

  const response = await authenticatedFetch(`${PRODUCTOS_API}/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl: saved.imageUrl,
      imageKey: saved.imageKey,
      imageMimeType: saved.imageMimeType,
      imageSize: saved.imageSize,
    }),
  });

  if (!response.ok) {
    await throwApiError(response, 'Error al guardar la imagen del producto.');
  }
}
