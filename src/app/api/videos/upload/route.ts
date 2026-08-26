import { NextRequest, NextResponse } from 'next/server';
import {
  getStorageProvider,
  getVideoAllowedMimeTypes,
  getVideoMaxSizeBytes,
} from '@/config/videos';
import {
  getStorageProvider as getProviderInstance,
  isValidLocalVideoKey,
} from '@/lib/storage';
import { withAuth } from '@/lib/with-auth';
import { withApiErrorHandling } from '@/lib/api-handler';
import { ValidationError } from '@/domain/errors';

export const POST = withApiErrorHandling(
  withAuth(async (request: NextRequest) => {
    const providerName = getStorageProvider();

    if (providerName !== 'local') {
      throw new ValidationError('La subida directa solo está disponible en modo local.');
    }

    const formData = await request.formData();
    const key = formData.get('key')?.toString();
    const file = formData.get('file');

    if (!key || !(file instanceof File)) {
      throw new ValidationError('Faltan el identificador o el archivo.');
    }

    if (!isValidLocalVideoKey(key)) {
      throw new ValidationError('El identificador del video no es válido.');
    }

    const allowedTypes = getVideoAllowedMimeTypes();
    if (!allowedTypes.includes(file.type)) {
      throw new ValidationError(
        `El tipo de archivo ${file.type} no está permitido. Tipos permitidos: ${allowedTypes.join(', ')}.`
      );
    }

    if (file.size > getVideoMaxSizeBytes()) {
      throw new ValidationError(
        `El archivo supera el tamaño máximo permitido de ${getVideoMaxSizeBytes()} bytes.`
      );
    }

    const provider = getProviderInstance('local');
    if (!provider.saveFile) {
      throw new Error('El proveedor local no soporta guardar archivos.');
    }

    const publicUrl = await provider.saveFile(key, file);

    return NextResponse.json({ url: publicUrl }, { status: 200 });
  }, { admin: true })
);
