'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { groupPublicProductsByType } from '@/lib/catalog';
import { groupCartItemsForSubmit } from '@/lib/cart-helpers';
import type { PromoOptionsConfirmPayload } from '@/components/promo/promo-options-dialog';
import { getPedidoRefetchIntervalMs } from '@/config/catalog';
import {
  PUBLIC_CATALOGO_API,
  PUBLIC_DISPONIBILIDAD_API,
  PUBLIC_SUCURSAL_ESTADO_API,
  PUBLIC_PEDIDO_API,
  PUBLIC_PEDIDO_CANCELAR_API,
} from '@/config/api';
import { throwApiError } from '@/lib/fetch';
import { toPublicErrorMessage } from '@/lib/public-errors';
import { useCart } from '@/hooks/useCart';
import { useRecentOrders } from '@/hooks/useRecentOrders';
import { useVisibilityPolling } from '@/hooks/use-visibility-polling';
import { cleanupRecentOrdersForBranches } from '@/lib/recent-orders';
import { routes } from '@/config/routes';
import type { CartItem } from '@/hooks/useCart';
import type { RecentOrder } from '@/lib/recent-orders';
import type { ProductGroup } from '@/lib/product-grouping';
import type { Branch } from '@/domain/types';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { PublicOrderItem } from '@/domain/types';

export interface CreatedOrder {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  customerPhone: string;
  deliveryType: 'delivery' | 'pickup';
  address: string | null;
  notes: string | null;
  cancellationToken: string;
  branchName: string | null;
  items: PublicOrderItem[];
  createdAt: string;
  expiresAt: string;
}

export interface UsePedidoClientProps {
  branches: Branch[];
  activeBranch: Branch;
  initialProducts: PublicCatalogProduct[];
  /** Total de productos públicos de la sucursal (para "Cargar más"). */
  initialTotal?: number;
  /** Tamaño de página para las cargas incrementales del catálogo. */
  pageSize?: number;
}

const BRANCH_STORAGE_KEY = 'pancheria-branch-id';

export interface BranchStatus {
  isOpen: boolean;
  currentOpening: string;
  nextOpening: string;
  message: string;
  branch: Branch;
}

export interface UsePedidoClientResult {
  products: PublicCatalogProduct[];
  error: string | null;
  /**
   * Productos cuyo carrito no alcanza la disponibilidad. El API público solo
   * expone la presencia del faltante, sin nombres de insumos ni cantidades.
   */
  shortageByProduct: Record<number, boolean>;
  isCheckingAvailability: boolean;

  checkoutOpen: boolean;
  setCheckoutOpen: (value: boolean) => void;
  branchStatus: BranchStatus | null;
  /** `true` cuando ya se consultó el estado de la sucursal al menos una vez. */
  branchStatusChecked: boolean;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  deliveryType: 'delivery' | 'pickup';
  setDeliveryType: (value: 'delivery' | 'pickup') => void;
  address: string;
  setAddress: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  isSubmitting: boolean;
  checkoutError: string | null;

  successDialogOpen: boolean;
  setSuccessDialogOpen: (value: boolean) => void;
  createdOrder: CreatedOrder | null;
  cancellationReason: string;
  setCancellationReason: (value: string) => void;
  isCancelling: boolean;
  cancellationError: string | null;

  items: CartItem[];
  total: number;
  inCartQuantityByProduct: Record<number, number>;
  addItem: (product: PublicCatalogProduct, selectedRecipeItemIds?: number[]) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateSelectedRecipeItemIds: (lineId: string, selectedRecipeItemIds: number[]) => void;
  clearCart: () => void;

  editingLine: { lineId: string; product: PublicCatalogProduct; initialSelectedIds: number[]; dialogKey: string } | null;
  startEditLine: (lineId: string) => void;
  cancelEditLine: () => void;
  confirmEditLine: (payload: PromoOptionsConfirmPayload) => void;

  recentOrders: RecentOrder[];
  removeRecentOrder: (orderId: number) => void;

  groupedProducts: ProductGroup<PublicCatalogProduct>[];
  isActiveBranchValid: boolean;

  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;

  handleBranchChange: (branchId: string | null) => void;
  handleOpenCheckout: () => void;
  handleSubmitCheckout: () => Promise<void>;
  handleCancelOrder: () => Promise<void>;
  handleGoToChat: () => void;
}

export function usePedidoClient({
  branches,
  activeBranch,
  initialProducts,
  initialTotal,
  pageSize,
}: UsePedidoClientProps): UsePedidoClientResult {
  const router = useRouter();
  const isMountedRef = useRef(true);

  const resolvedPageSize =
    pageSize && pageSize > 0 ? pageSize : initialProducts.length || 1;

  const [products, setProducts] = useState<PublicCatalogProduct[]>(initialProducts);
  const [totalProducts, setTotalProducts] = useState<number>(
    initialTotal ?? initialProducts.length
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadedCountRef = useRef(initialProducts.length);

  useEffect(() => {
    loadedCountRef.current = products.length;
  }, [products.length]);
  const [error, setError] = useState<string | null>(null);
  const [shortageByProduct, setShortageByProduct] = useState<
    Record<number, boolean>
  >({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [branchStatus, setBranchStatus] = useState<BranchStatus | null>(null);
  const [branchStatusChecked, setBranchStatusChecked] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('pickup');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);

  const [editingLine, setEditingLine] = useState<{
    lineId: string;
    product: PublicCatalogProduct;
    initialSelectedIds: number[];
    dialogKey: string;
  } | null>(null);

  const getAvailability = useCallback(
    (productId: number) => {
      const product = products.find((p) => p.id === productId);
      return product?.availability ?? 0;
    },
    [products]
  );

  const {
    items,
    total,
    addItem: cartAddItem,
    removeItem,
    updateQuantity,
    updateSelectedRecipeItemIds,
    clearCart,
  } = useCart({
    branchId: activeBranch.id,
    products,
    getAvailability,
  });

  useEffect(() => {
    isMountedRef.current = true;

    const stored = localStorage.getItem(BRANCH_STORAGE_KEY);
    const storedBranchId = stored ? Number(stored) : NaN;
    const branchIds = branches.map((b) => b.id);

    if (!stored || Number.isNaN(storedBranchId)) {
      localStorage.setItem(BRANCH_STORAGE_KEY, String(activeBranch.id));
    } else if (!branches.some((b) => b.id === storedBranchId)) {
      // La sucursal guardada fue eliminada: limpiar estados vinculados.
      localStorage.removeItem(BRANCH_STORAGE_KEY);
      localStorage.removeItem('pancheria-cart-v1');
      cleanupRecentOrdersForBranches(branchIds);
      clearCart();

      // Limpiar claves del tour asociadas a sucursales inexistentes.
      if (typeof window !== 'undefined') {
        const validBranchIds = new Set(branchIds);
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith('pancheria-tour-')) continue;
          const match = key.match(/^pancheria-tour-(?:step|active|seen)-[^-]+-(\d+)$/);
          if (match) {
            const branchIdFromKey = Number(match[1]);
            if (!validBranchIds.has(branchIdFromKey)) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } else if (storedBranchId !== activeBranch.id) {
      localStorage.setItem(BRANCH_STORAGE_KEY, String(activeBranch.id));
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [activeBranch.id, branches, clearCart]);

  const { orders: recentOrders, add: addRecentOrder, remove: removeRecentOrder } =
    useRecentOrders();

  // Consulta el estado de la sucursal (horarios + caja abierta). Se usa al
  // montar el catálogo, junto al refresco del catálogo por polling (para
  // reflejar cierres mientras el cliente navega) y al abrir el checkout,
  // donde actúa como segunda verificación.
  const fetchBranchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${PUBLIC_SUCURSAL_ESTADO_API}?branchId=${activeBranch.id}`
      );
      if (!response.ok) return;
      const data = (await response.json()) as BranchStatus;
      if (!isMountedRef.current) return;
      if (typeof data?.isOpen === 'boolean') {
        setBranchStatus(data);
      }
    } catch {
      // Si no se puede consultar, no bloqueamos el flujo;
      // la validación final ocurre al enviar el pedido.
    } finally {
      if (isMountedRef.current) setBranchStatusChecked(true);
    }
  }, [activeBranch.id]);

  // Consulta inicial del estado de la sucursal al montar, diferida con
  // `queueMicrotask` para no actualizar estado de forma síncrona en el efecto.
  useEffect(() => {
    queueMicrotask(() => {
      void fetchBranchStatus();
    });
  }, [fetchBranchStatus]);

  const refreshCatalog = useCallback(async () => {
    try {
      // Refresca todos los productos ya cargados para no perder páginas
      // traídas con "Cargar más".
      const limit = Math.max(loadedCountRef.current, resolvedPageSize);
      const response = await fetch(
        `${PUBLIC_CATALOGO_API}?branchId=${activeBranch.id}&includeAvailability=true&limit=${limit}`
      );
      if (!response.ok) {
        await throwApiError(response, 'Error al refrescar el catálogo');
      }

      const data = (await response.json()) as {
        branch: Branch;
        products: PublicCatalogProduct[];
        total?: number;
      };
      if (!isMountedRef.current) return;
      setProducts(data.products);
      if (data.total !== undefined) setTotalProducts(data.total);
    } catch {
      // No saturar la UI con errores de fondo.
    }
  }, [activeBranch.id, resolvedPageSize]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || products.length >= totalProducts) return;

    setIsLoadingMore(true);
    void (async () => {
      try {
        const offset = loadedCountRef.current;
        const response = await fetch(
          `${PUBLIC_CATALOGO_API}?branchId=${activeBranch.id}&includeAvailability=true&limit=${resolvedPageSize}&offset=${offset}`
        );
        if (!response.ok) {
          await throwApiError(response, 'Error al cargar más productos');
        }

        const data = (await response.json()) as {
          branch: Branch;
          products: PublicCatalogProduct[];
          total?: number;
        };
        if (!isMountedRef.current) return;

        // Deduplicar por id: si entre medio se insertó un producto, el offset
        // puede repetir el último ítem de la página anterior.
        setProducts((prev) => {
          const known = new Set(prev.map((p) => p.id));
          const next = data.products.filter((p) => !known.has(p.id));
          return next.length > 0 ? [...prev, ...next] : prev;
        });
        if (data.total !== undefined) setTotalProducts(data.total);
      } catch {
        // Error silencioso: el usuario puede reintentar con "Cargar más".
      } finally {
        if (isMountedRef.current) setIsLoadingMore(false);
      }
    })();
  }, [activeBranch.id, isLoadingMore, products.length, totalProducts, resolvedPageSize]);

  useVisibilityPolling(
    () => {
      void refreshCatalog();
      void fetchBranchStatus();
    },
    getPedidoRefetchIntervalMs(),
    true,
    false
  );

  useEffect(() => {
    if (items.length === 0) {
      queueMicrotask(() => {
        setShortageByProduct({});
      });
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingAvailability(true);

      try {
        const response = await fetch(
          `${PUBLIC_DISPONIBILIDAD_API}?branchId=${activeBranch.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: groupCartItemsForSubmit(
                items.map((item) => ({
                  productId: item.id,
                  quantity: item.quantity,
                  selectedRecipeItemIds: item.selectedRecipeItemIds,
                }))
              ),
            }),
          }
        );

        if (!response.ok) {
          await throwApiError(response, 'Error al validar disponibilidad');
        }

        const data = (await response.json()) as {
          availabilityByProduct: Record<number, number>;
          shortageByProduct: Record<number, boolean>;
        };

        if (!isMountedRef.current) return;
        setShortageByProduct(data.shortageByProduct ?? {});
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(
          err instanceof Error
            ? toPublicErrorMessage(err)
            : 'Error desconocido'
        );
      } finally {
        if (isMountedRef.current) setIsCheckingAvailability(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [items, products, activeBranch.id]);

  const groupedProducts = groupPublicProductsByType(products);
  const isActiveBranchValid = branches.some((b) => b.id === activeBranch.id);

  const inCartQuantityByProduct = useMemo(() => {
    const result: Record<number, number> = {};
    for (const item of items) {
      result[item.id] = (result[item.id] ?? 0) + item.quantity;
    }
    return result;
  }, [items]);

  const addItem = useCallback(
    (product: PublicCatalogProduct, selectedRecipeItemIds?: number[]) => {
      cartAddItem(product, selectedRecipeItemIds);
    },
    [cartAddItem]
  );

  const startEditLine = useCallback(
    (lineId: string) => {
      const item = items.find((i) => i.lineId === lineId);
      if (!item) return;

      const product = products.find((p) => p.id === item.id);
      if (!product) return;

      setEditingLine({
        lineId,
        product,
        initialSelectedIds: item.selectedRecipeItemIds ?? [],
        dialogKey: nanoid(),
      });
    },
    [items, products]
  );

  const cancelEditLine = useCallback(() => {
    setEditingLine(null);
  }, []);

  const confirmEditLine = useCallback(
    ({ selectedRecipeItemIds }: PromoOptionsConfirmPayload) => {
      if (!editingLine) return;
      updateSelectedRecipeItemIds(editingLine.lineId, selectedRecipeItemIds);
      setEditingLine(null);
    },
    [editingLine, updateSelectedRecipeItemIds]
  );

  function handleBranchChange(branchId: string | null) {
    if (!branchId) return;
    const selected = branches.find((b) => b.id === Number(branchId));
    if (!selected || selected.id === activeBranch.id) return;

    localStorage.setItem(BRANCH_STORAGE_KEY, String(selected.id));
    clearCart();
    router.push(`${routes.pedido}?branchId=${selected.id}`);
  }

  async function handleOpenCheckout() {
    setCheckoutOpen(true);
    setCheckoutError(null);
    await fetchBranchStatus();
  }

  async function handleSubmitCheckout() {
    setCheckoutError(null);

    if (!customerName.trim()) {
      setCheckoutError('El nombre del cliente es obligatorio.');
      return;
    }

    const phoneRegex = /^\+?\d{8,15}$/;
    const phoneCleaned = customerPhone.replace(/\s/g, '');
    if (!phoneRegex.test(phoneCleaned)) {
      setCheckoutError(
        'El teléfono es obligatorio y debe contener entre 8 y 15 dígitos.'
      );
      return;
    }

    if (deliveryType === 'delivery' && !address.trim()) {
      setCheckoutError('La dirección de envío es obligatoria.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${PUBLIC_PEDIDO_API}?branchId=${activeBranch.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: groupCartItemsForSubmit(
            items.map((item) => ({
              productId: item.id,
              quantity: item.quantity,
              selectedRecipeItemIds: item.selectedRecipeItemIds,
            }))
          ),
          customerName: customerName.trim(),
          customerPhone: phoneCleaned,
          deliveryType,
          address: deliveryType === 'delivery' ? address.trim() : undefined,
          notes: notes.trim() || undefined,
          idempotencyKey: nanoid(),
        }),
      });

      if (!response.ok) {
        await throwApiError(response, 'Error al crear el pedido');
      }

      const { order } = (await response.json()) as {
        order: CreatedOrder;
      };

      setCreatedOrder(order);
      addRecentOrder({
        id: order.id,
        orderNumber: order.orderNumber,
        cancellationToken: order.cancellationToken,
        expiresAt: order.expiresAt,
        branchId: activeBranch.id,
        branchName: order.branchName ?? activeBranch.name,
      });
      setSuccessDialogOpen(true);
      setCheckoutOpen(false);
      clearCart();
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryType('pickup');
      setAddress('');
      setNotes('');
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? toPublicErrorMessage(err) : 'Error desconocido'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelOrder() {
    if (!createdOrder) return;

    setIsCancelling(true);
    setCancellationError(null);

    try {
      const response = await fetch(
        `${PUBLIC_PEDIDO_CANCELAR_API(createdOrder.id)}?branchId=${activeBranch.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: cancellationReason.trim() || 'Cancelado por el cliente',
            token: createdOrder.cancellationToken,
          }),
        }
      );

      if (!response.ok) {
        await throwApiError(response, 'Error al cancelar el pedido');
      }

      setSuccessDialogOpen(false);
      setCreatedOrder(null);
      setCancellationReason('');
    } catch (err) {
      setCancellationError(
        err instanceof Error ? toPublicErrorMessage(err) : 'Error desconocido'
      );
    } finally {
      setIsCancelling(false);
    }
  }

  function handleGoToChat() {
    if (!createdOrder) return;
    router.push(
      routes.pedidoChat(createdOrder.id, createdOrder.cancellationToken)
    );
  }

  return {
    products,
    error,
    shortageByProduct,
    isCheckingAvailability,

    checkoutOpen,
    setCheckoutOpen,
    branchStatus,
    branchStatusChecked,
    customerName,
    setCustomerName,
    customerPhone,
    setCustomerPhone,
    deliveryType,
    setDeliveryType,
    address,
    setAddress,
    notes,
    setNotes,
    isSubmitting,
    checkoutError,

    successDialogOpen,
    setSuccessDialogOpen,
    createdOrder,
    cancellationReason,
    setCancellationReason,
    isCancelling,
    cancellationError,

    items,
    total,
    inCartQuantityByProduct,
    addItem,
    removeItem,
    updateQuantity,
    updateSelectedRecipeItemIds,
    clearCart,

    editingLine,
    startEditLine,
    cancelEditLine,
    confirmEditLine,

    recentOrders,
    removeRecentOrder,

    groupedProducts,
    isActiveBranchValid,

    hasMore: products.length < totalProducts,
    isLoadingMore,
    loadMore,

    handleBranchChange,
    handleOpenCheckout,
    handleSubmitCheckout,
    handleCancelOrder,
    handleGoToChat,
  };
}
