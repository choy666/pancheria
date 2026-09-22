import { NextRequest, NextResponse } from 'next/server';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';
import * as productRepository from '@/repositories/productRepository';
import { getStorageProvider } from '@/config/videos';
import { saveProductImage } from '@/lib/product-image-storage';
import { ValidationError } from '@/domain/errors';

// Este endpoint solo tiene sentido para el proveedor local. Los proveedores
// remotos (vercel-blob, s3, r2) reciben la subida directamente desde el
// cliente usando las instrucciones devueltas por /api/productos/imagen/preparar.
export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest, _context, { branchId }) => {
    const provider = getStorageProvider();

    if (provider !== 'local') {
      throw new ValidationError(
        'La subida directa solo está disponible en modo local.'
      );
    }

    // `formData()` lanza TypeError cuando el Content-Type no es
    // multipart ni urlencoded: se mapea a 400 en vez de caer al 500
    // genérico (mismo patrón que los uploads de chat, QA-2026-09-21-03).
    // Otros errores se propagan.
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      throw new ValidationError('El cuerpo debe ser multipart/form-data.');
    }
    const key = formData.get('key')?.toString();
    const file = formData.get('file');

    if (!key || !(file instanceof File)) {
      throw new ValidationError('Faltan la clave o el archivo.');
    }

    const productId = Number(key.split('/')[1]);
    if (Number.isNaN(productId) || productId <= 0) {
      throw new ValidationError('La clave no contiene un producto válido.');
    }

    const product = await productRepository.findById(
      branchId,
      productId,
      false
    );

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado.' },
        { status: 404 }
      );
    }

    const saved = await saveProductImage(file, productId, key, branchId);

    return NextResponse.json({
      key: saved.key,
      url: saved.publicUrl,
      mimeType: saved.mimeType,
      size: saved.size,
    });
  }, { admin: true })
);
