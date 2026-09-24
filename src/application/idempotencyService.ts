import { createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { sales, orders } from '@/db/schema';
import { ConflictError } from '@/domain/errors';
import type { PaymentPart, SaleItemInput } from '@/domain/types';

type IdempotencyScope = 'sale' | 'order';

const IDEMPOTENCY_CONFLICT_MESSAGE =
  'La clave de idempotencia ya fue utilizada con una solicitud diferente. Iniciá un nuevo intento.';
const IDEMPOTENCY_LEGACY_MESSAGE =
  'No se pudo validar una clave de idempotencia anterior. Verificá si la operación ya se procesó antes de iniciar otra.';

function serializeCanonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(serializeCanonical).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${serializeCanonical(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

export function createIdempotencyHash(scope: string, payload: unknown): string {
  return createHash('sha256')
    .update(serializeCanonical({ version: 1, scope, payload }))
    .digest('hex');
}

export function normalizeIdempotencyItems(items: SaleItemInput[]) {
  return items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      selectedRecipeItemIds: [...(item.selectedRecipeItemIds ?? [])].sort(
        (left, right) => left - right
      ),
    }))
    .sort((left, right) => {
      const leftKey = serializeCanonical(left);
      const rightKey = serializeCanonical(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
}

export function normalizeIdempotencyPayments(payments: PaymentPart[]) {
  return payments.map(({ method, amount }) => ({ method, amount }));
}

export function assertIdempotencyHashMatches(
  storedHash: string | null | undefined,
  requestHash: string
): void {
  if (storedHash === null || storedHash === undefined) {
    throw new ConflictError(IDEMPOTENCY_LEGACY_MESSAGE);
  }
  if (storedHash !== requestHash) {
    throw new ConflictError(IDEMPOTENCY_CONFLICT_MESSAGE);
  }
}

export function stripIdempotencyHash<T extends object>(
  resource: T
): Omit<T, 'idempotencyHash'> {
  const safeResource = { ...resource } as T & {
    idempotencyHash?: string | null;
  };
  delete safeResource.idempotencyHash;
  return safeResource as Omit<T, 'idempotencyHash'>;
}

type SaleRow = typeof sales.$inferSelect;
type OrderRow = typeof orders.$inferSelect;

type SaleWithPayments = SaleRow & { payments: PaymentPart[] };

async function getLegacySaleHash(
  client: typeof db,
  branchId: number,
  key: string
): Promise<string | null> {
  const sale = await client.query.sales.findFirst({
    where: and(
      eq(sales.branchId, branchId),
      eq(sales.idempotencyKey, key)
    ),
    with: {
      items: { with: { product: true, recipeSnapshots: true } },
      payments: { orderBy: (payment, { asc }) => [asc(payment.id)] },
    },
  });
  if (!sale) return null;

  const savedPayments = sale.payments ?? [];
  const payments = normalizeIdempotencyPayments(
    savedPayments.length > 0
      ? savedPayments
      : [{ method: sale.paymentMethod, amount: sale.total }]
  );
  const convertedOrder = await client.query.orders.findFirst({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.convertedSaleId, sale.id)
    ),
    columns: { id: true },
  });

  if (convertedOrder) {
    return createIdempotencyHash('sale.order-conversion', {
      branchId,
      orderId: convertedOrder.id,
      payments,
    });
  }

  const savedItems = sale.items ?? [];
  if (
    savedItems.some(
      (item) =>
        !item.product ||
        (item.product.type === 'compound' && !item.recipeSnapshots?.length)
    )
  ) {
    return null;
  }

  return createIdempotencyHash('sale.create', {
    branchId,
    items: normalizeIdempotencyItems(
      savedItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        selectedRecipeItemIds: (item.recipeSnapshots ?? [])
          .filter((recipe) => recipe.isOptional && recipe.selected)
          .map((recipe) => recipe.supplyId),
      }))
    ),
    payments,
  });
}

export async function findExistingByIdempotencyKey(
  scope: 'sale',
  branchId: number,
  key: string,
  client?: typeof db
): Promise<SaleWithPayments | null>;
export async function findExistingByIdempotencyKey(
  scope: 'order',
  branchId: number,
  key: string,
  client?: typeof db
): Promise<OrderRow | null>;
export async function findExistingByIdempotencyKey(
  scope: IdempotencyScope,
  branchId: number,
  key: string,
  client?: typeof db
): Promise<SaleWithPayments | OrderRow | null>;
export async function findExistingByIdempotencyKey(
  scope: IdempotencyScope,
  branchId: number,
  key: string,
  client: typeof db = db
): Promise<SaleWithPayments | OrderRow | null> {
  if (scope === 'sale') {
    const existing = await client.query.sales.findFirst({
      where: and(
        eq(sales.branchId, branchId),
        eq(sales.idempotencyKey, key)
      ),
      with: {
        payments: true,
      },
    });
    if (!existing) return null;
    if (existing.idempotencyHash !== null && existing.idempotencyHash !== undefined) {
      return existing as SaleWithPayments;
    }

    const legacyHash = await getLegacySaleHash(client, branchId, key);
    return { ...existing, idempotencyHash: legacyHash } as SaleWithPayments;
  }

  const existing = await client.query.orders.findFirst({
    where: and(
      eq(orders.branchId, branchId),
      eq(orders.idempotencyKey, key)
    ),
  });
  return (existing as OrderRow | undefined) ?? null;
}

export async function isIdempotencyKeyUsed(
  scope: IdempotencyScope,
  branchId: number,
  key: string,
  client?: typeof db
): Promise<boolean> {
  const existing = await findExistingByIdempotencyKey(
    scope,
    branchId,
    key,
    client
  );
  return !!existing;
}
