import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as orderService from '@/application/services/orderService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { orderSchema } from '@/lib/zod-schemas';
import { getDefaultBranchId, DEFAULT_BRANCH_ERROR } from '@/lib/branch-resolver';
import { buildWhatsAppMessage, encodeWhatsAppUrl } from '@/lib/whatsapp';
import { getWhatsAppNumber, getWhatsAppMessageParts } from '@/config/catalog';
import {
  createPublicOrderRateLimitStore,
  type PublicOrderRateLimitStore,
} from '@/lib/public-order-rate-limit-store';
import type { PublicOrderItem } from '@/lib/whatsapp';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

const RATE_LIMIT_WINDOW_MS = Number(
  process.env.PUBLIC_ORDER_RATE_LIMIT_WINDOW_MS ?? 60_000
);
const RATE_LIMIT_MAX_REQUESTS = Number(
  process.env.PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS ?? 10
);

const rateLimitStore: PublicOrderRateLimitStore =
  createPublicOrderRateLimitStore();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return (request as unknown as { ip?: string }).ip ?? 'unknown';
}

async function isRateLimited(ip: string): Promise<boolean> {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  const now = Date.now();
  const record = await rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    await rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  record.count += 1;

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  await rateLimitStore.set(ip, record);
  return false;
}

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

  let phone: string;
  try {
    phone = getWhatsAppNumber();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error de configuración de WhatsApp';
    return NextResponse.json({ error: message }, { status: 400 });
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

  const { greeting, closing } = getWhatsAppMessageParts();
  const messageBody = buildWhatsAppMessage(publicOrder);
  const fullMessage = `${greeting}\n\n${messageBody}\n\n${closing}`;
  const whatsappUrl = encodeWhatsAppUrl(phone, fullMessage);

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
        sentAt: order.sentAt,
      },
      whatsappUrl,
    },
    { status: 201 }
  );
});

export const runtime = 'nodejs';
