import { z } from 'zod';
import { routes } from '@/config/routes';

const recentOrderSchema = z.object({
  id: z.number().int().positive(),
  orderNumber: z.string(),
  cancellationToken: z.string(),
  expiresAt: z.string().datetime(),
  branchId: z.number().int().positive(),
  branchName: z.string(),
});

const recentOrdersStorageSchema = z.object({
  version: z.literal('pancheria-recent-orders-v1'),
  orders: z.array(recentOrderSchema),
});

export type RecentOrder = z.infer<typeof recentOrderSchema>;

const STORAGE_KEY = 'pancheria-recent-orders-v1';
const MAX_RECENT_ORDERS = 5;

type Listener = () => void;

const listeners: Listener[] = [];
let isStorageSubscribed = false;

let cachedOrders: RecentOrder[] | null = null;
let cachedRaw: string | null = null;

function getStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function parseStoredOrders(raw: string | null): RecentOrder[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const stored = recentOrdersStorageSchema.safeParse(parsed);
    return stored.success ? stored.data.orders : [];
  } catch {
    return [];
  }
}

function isExpired(order: RecentOrder): boolean {
  return new Date(order.expiresAt).getTime() <= Date.now();
}

function readOrders(): RecentOrder[] {
  const storage = getStorage();
  const raw = storage.getItem(STORAGE_KEY);
  return parseStoredOrders(raw).filter((order) => !isExpired(order));
}

function saveOrders(orders: RecentOrder[]): void {
  const storage = getStorage();
  if (orders.length === 0) {
    storage.removeItem(STORAGE_KEY);
    return;
  }

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 'pancheria-recent-orders-v1',
      orders,
    })
  );
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function handleStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY) {
    emitChange();
  }
}

export function getRecentOrders(): RecentOrder[] {
  const storage = getStorage();
  const raw = storage.getItem(STORAGE_KEY);

  if (raw === cachedRaw && cachedOrders) {
    return cachedOrders;
  }

  const orders = parseStoredOrders(raw).filter((order) => !isExpired(order));
  cachedRaw = raw;
  cachedOrders = orders;
  return orders;
}

export function addRecentOrder(order: RecentOrder): void {
  if (isExpired(order)) return;

  const orders = readOrders().filter((o) => o.id !== order.id);
  orders.unshift(order);

  if (orders.length > MAX_RECENT_ORDERS) {
    orders.length = MAX_RECENT_ORDERS;
  }

  saveOrders(orders);
  emitChange();
}

export function removeRecentOrder(orderId: number): void {
  const orders = readOrders().filter((order) => order.id !== orderId);
  saveOrders(orders);
  emitChange();
}

export function cleanupRecentOrdersForBranches(validBranchIds: number[]): void {
  const validBranchIdSet = new Set(validBranchIds);
  const orders = readOrders().filter((order) =>
    validBranchIdSet.has(order.branchId)
  );
  saveOrders(orders);
  if (orders.length === 0) {
    cachedOrders = [];
    cachedRaw = null;
  } else {
    cachedRaw = JSON.stringify({ version: 'pancheria-recent-orders-v1', orders });
    cachedOrders = orders;
  }
  emitChange();
}

export function subscribeRecentOrders(listener: Listener): () => void {
  if (typeof window !== 'undefined' && !isStorageSubscribed) {
    window.addEventListener('storage', handleStorage);
    isStorageSubscribed = true;
  }

  listeners.push(listener);

  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }

    if (typeof window !== 'undefined' && isStorageSubscribed && listeners.length === 0) {
      window.removeEventListener('storage', handleStorage);
      isStorageSubscribed = false;
    }
  };
}

export function buildChatUrl(orderId: number, token: string): string {
  return routes.pedidoChat(orderId, token);
}
