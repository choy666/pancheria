import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderSchema } from '@/lib/zod-schemas';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { getClientIp, createRateLimiter } from '@/lib/rate-limit';
import {
  getOrderRateLimitWindowMs,
  getOrderRateLimitMaxRequests,
} from '@/config/orders';
import type { PublicOrderItem } from '@/lib/whatsapp';

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
  const branchId = query.branchId ?? (await getDefaultBranchId());

  if (!branchId) {
    return NextResponse.json({ error: DEFAULT_BRANCH_ERROR }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (await isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiados pedidos. Intentalo más tarde.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const data = orderSchema.parse(body);

  const order = await orderService.createOrder({
    branchId,
    ...data,
  });

  const publicItems: PublicOrderItem[] = order.items.map((item) => ({
    productId: item.productId,
    name: item.product?.name ?? `Producto ${item.productId}`,
    price: item.product?.price ?? item.unitPrice,
    unit: item.product?.unit ?? 'unidad',
    quantity: item.quantity,
  }));

  const publicOrder = {
    items: publicItems,
    customerName: order.customerName,
    deliveryType: order.deliveryType,
    address: order.address ?? undefined,
    notes: order.notes ?? undefined,
    total: order.total,
    orderNumber: order.orderNumber,
    branchName: order.branch?.name,
  };

  let whatsappUrl: string | null = null;
  try {
    whatsappUrl = buildWhatsAppUrl(publicOrder);
  } catch {
    // Si no está configurado WhatsApp, el chat sigue siendo el canal principal.
    whatsappUrl = null;
  }

  return NextResponse.json(
    {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        customerName: order.customerName,
        deliveryType: order.deliveryType,
        address: order.address,
        notes: order.notes,
        cancellationToken: order.cancellationToken,
        branchName: order.branch?.name,
        items: publicItems,
        createdAt: order.createdAt,
      },
      whatsappUrl,
    },
    { status: 201 }
  );
});

export const runtime = 'nodejs';
