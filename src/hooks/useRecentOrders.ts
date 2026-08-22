import { useSyncExternalStore } from 'react';
import {
  getRecentOrders,
  addRecentOrder,
  removeRecentOrder,
  subscribeRecentOrders,
  type RecentOrder,
} from '@/lib/recent-orders';

const emptyServerSnapshot: RecentOrder[] = [];

export function useRecentOrders() {
  const orders = useSyncExternalStore<RecentOrder[]>(
    subscribeRecentOrders,
    getRecentOrders,
    () => emptyServerSnapshot
  );

  return {
    orders,
    add: addRecentOrder,
    remove: removeRecentOrder,
  };
}
