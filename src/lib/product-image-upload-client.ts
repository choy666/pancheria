import { authenticatedFetch } from '@/lib/fetch';

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

async function prepareProductImageUpload(
  file: File,
  productId: number
): Promise<ProductImageUploadInstructions> {
  const response = await authenticatedFetch(
    '/api/productos/imagen/preparar',
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
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || 'Error al preparar la subida de la imagen.');
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
      throw new Error(
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
    throw new Error(
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
    throw new Error('No se pudo obtener la URL pública de la imagen.');
  }

  return {
    imageUrl,
    imageKey: instructions.key,
    imageMimeType: file.type,
    imageSize: file.size,
  };
}
