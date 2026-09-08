import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderSchema } from '@/lib/zod-schemas';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';
import { getClientIp, createRateLimiter } from '@/lib/rate-limit';
import { InsufficientStockError } from '@/domain/errors';
import { publicShortageMessage } from '@/lib/public-errors';
import {
  getOrderRateLimitWindowMs,
  getOrderRateLimitMaxRequests,
  getOrderExpirationMs,
} from '@/config/orders';
import type { PublicOrderItem } from '@/domain/types';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

const isRateLimited = createRateLimiter(
  'order',
  getOrderRateLimitWindowMs(),
  getOrderRateLimitMaxRequests()
);

export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));
  const ip = getClientIp(request);

  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Intentalo más tarde.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const data = orderSchema.parse(body);

  const branchId = query.branchId ?? (await getDefaultBranchId());

  if (!branchId) {
    return NextResponse.json({ error: DEFAULT_BRANCH_ERROR }, { status: 400 });
  }

  let order;
  try {
    order = await orderService.createOrder({
      branchId,
      ...data,
    });
  } catch (error) {
    // El flujo público no expone nombres de insumos ni cantidades de stock:
    // se devuelve un mensaje amigable junto a un código estructurado.
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        {
          error: publicShortageMessage(error.productName),
          code: 'INSUFFICIENT_STOCK',
          productName: error.productName,
        },
        { status: 409 }
      );
    }
    throw error;
  }

  const publicItems: PublicOrderItem[] = order.items.map((item) => ({
    productId: item.productId,
    name: item.product?.name ?? `Producto ${item.productId}`,
    price: item.product?.price ?? item.unitPrice,
    unit: item.product?.unit ?? 'unidad',
    quantity: item.quantity,
    recipeSnapshot: item.recipeSnapshot,
  }));

  const expiresAt = new Date(
    order.createdAt.getTime() + getOrderExpirationMs()
  ).toISOString();

  return NextResponse.json(
    {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryType: order.deliveryType,
        address: order.address,
        notes: order.notes,
        cancellationToken: order.cancellationToken,
        branchName: order.branch?.name,
        items: publicItems,
        createdAt: order.createdAt,
        expiresAt,
      },
    },
    { status: 201 }
  );
}, 'POST /api/public/pedido');

export const runtime = 'nodejs';
