import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { products } from '@/db/schema';
import { withApiErrorHandling } from '@/lib/api-handler';
import { readProductImage } from '@/lib/product-image-storage';
import { isPublicSellableProduct } from '@/lib/catalog';

interface RouteParams {
  params: Promise<{ key: string }>;
}

function extractProductIdFromKey(key: string): number | null {
  const parts = key.split('/');
  if (parts.length < 2) return null;
  const productId = Number(parts[1]);
  if (Number.isNaN(productId) || productId <= 0) return null;
  return productId;
}

export const GET = withApiErrorHandling(
  async (request: NextRequest, { params }: RouteParams) => {
    const { key } = await params;
    const decodedKey = decodeURIComponent(key);

    const productId = extractProductIdFromKey(decodedKey);
    if (!productId) {
      return NextResponse.json(
        { error: 'Clave de imagen inválida.' },
        { status: 400 }
      );
    }

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.imageKey, decodedKey),
        eq(products.isActive, true),
        isNull(products.deletedAt)
      ),
    });

    if (!product || !isPublicSellableProduct(product)) {
      return NextResponse.json(
        { error: 'Imagen no encontrada.' },
        { status: 404 }
      );
    }

    const file = await readProductImage(decodedKey);

    if (!file) {
      return NextResponse.json(
        { error: 'Archivo de imagen no encontrado.' },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': file.mimeType,
        'Cache-Control': 'public, max-age=86400, must-revalidate',
      },
    });
  }
);

export const runtime = 'nodejs';
