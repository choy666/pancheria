import {
  assertIdempotencyHashMatches,
  createIdempotencyHash,
  findExistingByIdempotencyKey,
  isIdempotencyKeyUsed,
  normalizeIdempotencyItems,
} from './idempotencyService';
import { ConflictError } from '@/domain/errors';
import { db } from '@/db';

jest.mock('@/db', () => ({
  db: {
    query: {
      sales: {
        findFirst: jest.fn(),
      },
      orders: {
        findFirst: jest.fn(),
      },
    },
  },
}));

const mockedDb = db as unknown as {
  query: {
    sales: {
      findFirst: jest.Mock;
    };
    orders: {
      findFirst: jest.Mock;
    };
  };
};

const BRANCH_ID = 1;

function scopedKey(key: string) {
  return `${BRANCH_ID}:${key}`;
}

describe('idempotency payload fingerprints', () => {
  test('canonicalizes object keys, item ordering and optional selection ordering', () => {
    const itemsA = normalizeIdempotencyItems([
      { productId: 2, quantity: 1, selectedRecipeItemIds: [9, 3] },
      { productId: 1, quantity: 2 },
    ]);
    const itemsB = normalizeIdempotencyItems([
      { productId: 1, quantity: 2, selectedRecipeItemIds: [] },
      { productId: 2, quantity: 1, selectedRecipeItemIds: [3, 9] },
    ]);

    expect(
      createIdempotencyHash('order.create', { branchId: 1, items: itemsA })
    ).toBe(
      createIdempotencyHash('order.create', { items: itemsB, branchId: 1 })
    );
  });

  test('produce una huella distinta si cambia el alcance o el payload', () => {
    const payload = { branchId: 1, items: [{ productId: 1, quantity: 1 }] };
    const hash = createIdempotencyHash('order.create', payload);

    expect(createIdempotencyHash('sale.create', payload)).not.toBe(hash);
    expect(
      createIdempotencyHash('order.create', {
        ...payload,
        items: [{ productId: 1, quantity: 2 }],
      })
    ).not.toBe(hash);
  });

  test('rechaza huellas divergentes o no verificables y acepta huellas iguales', () => {
    expect(() => assertIdempotencyHashMatches('same-hash', 'same-hash')).not.toThrow();
    expect(() => assertIdempotencyHashMatches('stored-hash', 'new-hash')).toThrow(
      ConflictError
    );
    expect(() => assertIdempotencyHashMatches(null, 'new-hash')).toThrow(
      ConflictError
    );
  });
});

describe('idempotencyService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockedDb.query.sales.findFirst.mockReset();
    mockedDb.query.orders.findFirst.mockReset();
  });

  test('reconstruye la huella de una venta legacy desde sus items y pagos', async () => {
    const legacySale = {
      id: 20,
      branchId: BRANCH_ID,
      total: 1000,
      paymentMethod: 'cash',
      idempotencyKey: scopedKey('legacy-sale'),
      idempotencyHash: null,
      payments: [{ method: 'cash', amount: 1000 }],
      items: [
        {
          productId: 3,
          quantity: 1,
          product: { id: 3, type: 'critical_supply' },
          recipeSnapshots: [],
        },
      ],
    };
    mockedDb.query.sales.findFirst
      .mockResolvedValueOnce(legacySale)
      .mockResolvedValueOnce(legacySale);

    const result = await findExistingByIdempotencyKey(
      'sale',
      BRANCH_ID,
      scopedKey('legacy-sale')
    );

    expect(result?.idempotencyHash).toBe(
      createIdempotencyHash('sale.create', {
        branchId: BRANCH_ID,
        items: normalizeIdempotencyItems([{ productId: 3, quantity: 1 }]),
        payments: [{ method: 'cash', amount: 1000 }],
      })
    );
    expect(mockedDb.query.sales.findFirst).toHaveBeenCalledTimes(2);
  });

  test('reconstruye la huella de una conversión legacy con el pedido asociado', async () => {
    const legacySale = {
      id: 21,
      branchId: BRANCH_ID,
      total: 1000,
      paymentMethod: 'cash',
      idempotencyKey: scopedKey('legacy-conversion'),
      idempotencyHash: null,
      payments: [{ method: 'cash', amount: 1000 }],
      items: [],
    };
    mockedDb.query.sales.findFirst
      .mockResolvedValueOnce(legacySale)
      .mockResolvedValueOnce(legacySale);
    mockedDb.query.orders.findFirst.mockResolvedValue({ id: 77 });

    const result = await findExistingByIdempotencyKey(
      'sale',
      BRANCH_ID,
      scopedKey('legacy-conversion')
    );

    expect(result?.idempotencyHash).toBe(
      createIdempotencyHash('sale.order-conversion', {
        branchId: BRANCH_ID,
        orderId: 77,
        payments: [{ method: 'cash', amount: 1000 }],
      })
    );
  });

  test('devuelve true si la clave de idempotencia de venta ya fue usada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue({
      id: 1,
      idempotencyKey: scopedKey('key-123'),
    } as any);

    const result = await isIdempotencyKeyUsed(
      'sale',
      BRANCH_ID,
      scopedKey('key-123')
    );

    expect(result).toBe(true);
    expect(mockedDb.query.sales.findFirst).toHaveBeenCalled();
  });

  test('devuelve false si la clave de idempotencia de venta no fue usada', async () => {
    mockedDb.query.sales.findFirst.mockResolvedValue(undefined);

    const result = await isIdempotencyKeyUsed(
      'sale',
      BRANCH_ID,
      scopedKey('key-nueva')
    );

    expect(result).toBe(false);
    expect(mockedDb.query.sales.findFirst).toHaveBeenCalled();
  });

  test('devuelve true si la clave de idempotencia de pedido ya fue usada', async () => {
    mockedDb.query.orders.findFirst.mockResolvedValue({
      id: 1,
      idempotencyKey: scopedKey('key-123'),
    } as any);

    const result = await isIdempotencyKeyUsed(
      'order',
      BRANCH_ID,
      scopedKey('key-123')
    );

    expect(result).toBe(true);
    expect(mockedDb.query.orders.findFirst).toHaveBeenCalled();
  });

  test('devuelve false si la clave de idempotencia de pedido no fue usada', async () => {
    mockedDb.query.orders.findFirst.mockResolvedValue(undefined);

    const result = await isIdempotencyKeyUsed(
      'order',
      BRANCH_ID,
      scopedKey('key-nueva')
    );

    expect(result).toBe(false);
    expect(mockedDb.query.orders.findFirst).toHaveBeenCalled();
  });
});
