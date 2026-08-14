import { NextRequest, NextResponse } from 'next/server';
import { getStorageProvider } from '@/config/videos';
import { getStorageProvider as getProviderInstance } from '@/lib/storage';

export async function POST(request: NextRequest) {
  const providerName = getStorageProvider();

  if (providerName !== 'local') {
    return NextResponse.json(
      { error: 'La subida directa solo está disponible en modo local.' },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const key = formData.get('key')?.toString();
    const file = formData.get('file');

    if (!key || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Faltan el identificador o el archivo.' },
        { status: 400 }
      );
    }

    const provider = getProviderInstance('local');
    if (!provider.saveFile) {
      return NextResponse.json(
        { error: 'El proveedor local no soporta guardar archivos.' },
        { status: 500 }
      );
    }
    const publicUrl = await provider.saveFile(key, file);

    return NextResponse.json({ url: publicUrl }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error al guardar el archivo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
