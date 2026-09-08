'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductCard } from './product-card';
import { BranchStatusChip } from './branch-status-chip';
import {
  productTypeGroupClasses,
  publicProductTypeLabels,
} from '@/lib/product-style';
import { routes } from '@/config/routes';
import type { Branch } from '@/domain/types';
import type { BranchStatus } from './usePedidoClient';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { CartItem } from '@/hooks/useCart';
import type { ProductGroup } from '@/lib/product-grouping';
import type { ReactNode } from 'react';

interface PedidoCatalogSectionProps {
  branches: Branch[];
  activeBranch: Branch;
  branchStatus: BranchStatus | null;
  branchStatusChecked: boolean;
  groupedProducts: ProductGroup<PublicCatalogProduct>[];
  items: CartItem[];
  inCartQuantityByProduct?: Record<number, number>;
  isCheckingAvailability: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onBranchChange: (branchId: string | null) => void;
  onAdd: (product: PublicCatalogProduct, selectedRecipeItemIds?: number[]) => void;
  cart: ReactNode;
}

export function PedidoCatalogSection({
  branches,
  activeBranch,
  branchStatus,
  branchStatusChecked,
  groupedProducts,
  items,
  inCartQuantityByProduct: inCartQuantityByProductProp,
  isCheckingAvailability,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onBranchChange,
  onAdd,
  cart,
}: PedidoCatalogSectionProps) {
  const inCartIds = new Set(items.map((item) => item.id));

  const inCartQuantityByProduct =
    inCartQuantityByProductProp ??
    items.reduce<Record<number, number>>((acc, item) => {
      acc[item.id] = (acc[item.id] ?? 0) + item.quantity;
      return acc;
    }, {});

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
            <ol
              data-testid="pedido-steps"
              className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
            >
              <li>1. Elegí tus productos</li>
              <li aria-hidden="true">→</li>
              <li>2. Revisá tu pedido</li>
              <li aria-hidden="true">→</li>
              <li>3. Completá tus datos</li>
            </ol>
            <p className="mt-1 text-sm">
              <Link
                href={routes.pedidoSeguimiento}
                className="text-primary underline-offset-2 hover:underline"
              >
                ¿Ya hiciste un pedido? Seguilo acá
              </Link>
            </p>
          </div>

          <div className="w-full space-y-2 sm:w-auto">
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
            <BranchStatusChip
              branchStatus={branchStatus}
              activeBranch={activeBranch}
              checked={branchStatusChecked}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {groupedProducts.length === 0 && (
            <p
              data-testid="catalog-empty-state"
              className="rounded-lg border border-white/8 p-4 text-sm text-muted-foreground"
            >
              No hay productos disponibles en esta sucursal por ahora. Probá más
              tarde o elegí otra sucursal.
            </p>
          )}
          {groupedProducts.map((group) => (
            <div key={group.type} className="space-y-3">
              <h2
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${productTypeGroupClasses[group.type]}`}
              >
                {publicProductTypeLabels[group.type]}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    inCart={inCartIds.has(product.id)}
                    inCartQuantity={inCartQuantityByProduct[product.id] ?? 0}
                    onAdd={(selected) => onAdd(product, selected)}
                    disabled={isCheckingAvailability}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                data-testid="catalog-load-more"
                disabled={isLoadingMore}
                onClick={onLoadMore}
              >
                {isLoadingMore ? 'Cargando...' : 'Cargar más productos'}
              </Button>
            </div>
          )}
        </div>

        <div id="pedido-cart" className="scroll-mt-4 space-y-4">
          {cart}
        </div>
      </div>
    </div>
  );
}
