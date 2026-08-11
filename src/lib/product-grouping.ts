import type { CriticalSupplyType, ProductType } from '@/domain/types';

export type ProductGroup<T> = {
  type: ProductType;
  items: T[];
};

export function groupProductsByType<
  T extends {
    type: ProductType;
    name: string;
    criticalSupplyType?: CriticalSupplyType | null;
  }
>(
  products: T[],
  priority: Record<ProductType, number>,
  subPriority?: Record<CriticalSupplyType, number>
): ProductGroup<T>[] {
  const sorted = [...products].sort((a, b) => {
    const priorityDiff = (priority[a.type] ?? Infinity) - (priority[b.type] ?? Infinity);
    if (priorityDiff !== 0) return priorityDiff;

    if (
      subPriority &&
      a.type === 'critical_supply' &&
      b.type === 'critical_supply'
    ) {
      const aSub = a.criticalSupplyType;
      const bSub = b.criticalSupplyType;

      if (aSub && bSub) {
        const subDiff = (subPriority[aSub] ?? Infinity) - (subPriority[bSub] ?? Infinity);
        if (subDiff !== 0) return subDiff;
      } else if (aSub && !bSub) {
        return -1;
      } else if (!aSub && bSub) {
        return 1;
      }
    }

    return a.name.localeCompare(b.name);
  });

  const groups: ProductGroup<T>[] = [];

  for (const product of sorted) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.type === product.type) {
      lastGroup.items.push(product);
    } else {
      groups.push({ type: product.type, items: [product] });
    }
  }

  return groups;
}
