'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductCard } from './product-card';
import {
  productTypeGroupClasses,
  productTypeLabels,
} from '@/lib/product-style';
import { routes } from '@/config/routes';
import type { Branch } from '@/domain/types';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { RecipeBreakdownItem } from '@/application/services/saleService';
import type { CartItem } from '@/hooks/useCart';
import type { ProductGroup } from '@/lib/product-grouping';
import type { ReactNode } from 'react';

interface PedidoCatalogSectionProps {
  branches: Branch[];
  activeBranch: Branch;
  groupedProducts: ProductGroup<PublicCatalogProduct>[];
  items: CartItem[];
  breakdownByProduct: Record<number, RecipeBreakdownItem[]>;
  isCheckingAvailability: boolean;
  onBranchChange: (branchId: string | null) => void;
  onAdd: (product: PublicCatalogProduct, selectedRecipeItemIds?: number[]) => void;
  cart: ReactNode;
}

export function PedidoCatalogSection({
  branches,
  activeBranch,
  groupedProducts,
  items,
  breakdownByProduct,
  isCheckingAvailability,
  onBranchChange,
  onAdd,
  cart,
}: PedidoCatalogSectionProps) {
  const inCartIds = new Set(items.map((item) => item.id));

  return (
    <div className="space-y-5">
      <div className="space-y-2 rounded-2xl border border-white/8 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Catálogo de {activeBranch.name}
            </h1>
            <p className="text-base text-muted-foreground">
              Elegí los productos y armá tu pedido.
            </p>
            <p className="mt-1 text-sm">
              <Link
                href={routes.pedidoSeguimiento}
                className="text-primary underline-offset-2 hover:underline"
              >
                ¿Ya hiciste un pedido? Seguilo acá
              </Link>
            </p>
          </div>

          {branches.length > 1 ? (
            <div className="w-full sm:w-auto">
              <Label
                htmlFor="branchSelect"
                className="mb-1 block text-sm font-medium"
                data-testid="branch-select-label"
              >
                Sucursal
              </Label>
              <Select
                value={String(activeBranch.id)}
                onValueChange={onBranchChange}
              >
                <SelectTrigger
                  id="branchSelect"
                  data-testid="branch-select-trigger"
                  className="w-full sm:w-[260px]"
                >
                  <SelectValue placeholder="Seleccionar sucursal">
                    {(value) =>
                      branches.find((b) => String(b.id) === value)?.name ??
                      activeBranch.name
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)} label={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div
              className="flex items-center gap-2"
              data-testid="single-branch-indicator"
            >
              <span className="text-sm text-muted-foreground">Sucursal</span>
              <Badge variant="secondary">{activeBranch.name}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {groupedProducts.map((group) => (
            <div key={group.type} className="space-y-3">
              <h2
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${productTypeGroupClasses[group.type]}`}
              >
                {productTypeLabels[group.type]}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    inCart={inCartIds.has(product.id)}
                    breakdown={
                      breakdownByProduct[product.id] ?? product.breakdown ?? []
                    }
                    onAdd={(selected) => onAdd(product, selected)}
                    disabled={isCheckingAvailability}
                    showBreakdown={false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">{cart}</div>
      </div>
    </div>
  );
}
