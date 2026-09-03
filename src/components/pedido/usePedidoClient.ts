'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { groupPublicProductsByType } from '@/lib/catalog';
import { areRecipeSelectionsEqual } from '@/lib/cart-helpers';
import { getPedidoRefetchIntervalMs } from '@/config/catalog';
import {
  PUBLIC_CATALOGO_API,
  PUBLIC_DISPONIBILIDAD_API,
  PUBLIC_SUCURSAL_ESTADO_API,
  PUBLIC_PEDIDO_API,
  PUBLIC_PEDIDO_CANCELAR_API,
} from '@/config/api';
import { useCart } from '@/hooks/useCart';
import { useRecentOrders } from '@/hooks/useRecentOrders';
import { cleanupRecentOrdersForBranches } from '@/lib/recent-orders';
import { routes } from '@/config/routes';
import type { CartItem } from '@/hooks/useCart';
import type { RecentOrder } from '@/lib/recent-orders';
import type { ProductGroup } from '@/lib/product-grouping';
import type { Branch } from '@/domain/types';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { RecipeBreakdownItem } from '@/application/services/saleService';
import type { PublicOrderItem } from '@/lib/whatsapp';

interface ShortageInfo {
  available: number;
  required: number;
  supplyName: string;
}

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
  whatsappUrl: string | null;
}

export interface UsePedidoClientProps {
  branches: Branch[];
  activeBranch: Branch;
  initialProducts: PublicCatalogProduct[];
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
  shortageByProduct: Record<number, ShortageInfo>;
  breakdownByProduct: Record<number, RecipeBreakdownItem[]>;
  isCheckingAvailability: boolean;

  checkoutOpen: boolean;
  setCheckoutOpen: (value: boolean) => void;
  branchStatus: BranchStatus | null;
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
  confirmEditLine: (selectedRecipeItemIds: number[]) => void;

  recentOrders: RecentOrder[];
  removeRecentOrder: (orderId: number) => void;

  groupedProducts: ProductGroup<PublicCatalogProduct>[];
  isActiveBranchValid: boolean;

  handleBranchChange: (branchId: string | null) => void;
  handleOpenCheckout: () => void;
  handleSubmitCheckout: () => Promise<void>;
  handleCancelOrder: () => Promise<void>;
  handleOpenWhatsApp: () => void;
  handleGoToChat: () => void;
}

export function usePedidoClient({
  branches,
  activeBranch,
  initialProducts,
}: UsePedidoClientProps): UsePedidoClientResult {
  const router = useRouter();
  const isMountedRef = useRef(true);

  const [products, setProducts] = useState<PublicCatalogProduct[]>(initialProducts);
  const [error, setError] = useState<string | null>(null);
  const [shortageByProduct, setShortageByProduct] = useState<
    Record<number, ShortageInfo>
  >({});
  const [breakdownByProduct, setBreakdownByProduct] = useState<
    Record<number, RecipeBreakdownItem[]>
  >({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [branchStatus, setBranchStatus] = useState<BranchStatus | null>(null);
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

  useEffect(() => {
    const intervalMs = getPedidoRefetchIntervalMs();

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${PUBLIC_CATALOGO_API}?branchId=${activeBranch.id}&includeAvailability=true`
        );
        if (!response.ok) throw new Error('Error al refrescar el catálogo');

        const data = (await response.json()) as {
          branch: Branch;
          products: PublicCatalogProduct[];
        };
        if (!isMountedRef.current) return;
        setProducts(data.products);
      } catch {
        // No saturar la UI con errores de fondo.
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [activeBranch.id]);

  useEffect(() => {
    if (items.length === 0) {
      queueMicrotask(() => {
        setShortageByProduct({});
        setBreakdownByProduct({});
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
              items: items.map((item) => ({
                productId: item.id,
                quantity: item.quantity,
                selectedRecipeItemIds: item.selectedRecipeItemIds ?? [],
              })),
            }),
          }
        );

        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? 'Error al validar disponibilidad');
        }

        const data = (await response.json()) as {
          availabilityByProduct: Record<number, number>;
          shortageByProduct: Record<number, ShortageInfo>;
          breakdownByProduct: Record<number, RecipeBreakdownItem[]>;
        };

        if (!isMountedRef.current) return;
        setShortageByProduct(data.shortageByProduct ?? {});
        setBreakdownByProduct(data.breakdownByProduct ?? {});
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
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
    (selectedRecipeItemIds: number[]) => {
      if (!editingLine) return;

      const editedItem = items.find((i) => i.lineId === editingLine.lineId);
      if (!editedItem) {
        setEditingLine(null);
        return;
      }

      const matchingLine = items.find(
        (i) =>
          i.lineId !== editingLine.lineId &&
          i.id === editedItem.id &&
          areRecipeSelectionsEqual(i.selectedRecipeItemIds, selectedRecipeItemIds)
      );

      if (matchingLine) {
        updateQuantity(
          matchingLine.lineId,
          matchingLine.quantity + editedItem.quantity
        );
        removeItem(editingLine.lineId);
      } else {
        updateSelectedRecipeItemIds(editingLine.lineId, selectedRecipeItemIds);
      }

      setEditingLine(null);
    },
    [editingLine, items, removeItem, updateQuantity, updateSelectedRecipeItemIds]
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
    setBranchStatus(null);

    try {
      const response = await fetch(
        `${PUBLIC_SUCURSAL_ESTADO_API}?branchId=${activeBranch.id}`
      );
      if (response.ok) {
        const data = (await response.json()) as BranchStatus;
        if (isMountedRef.current) {
          setBranchStatus(data);
        }
      }
    } catch {
      // Si no se puede consultar, no bloqueamos el flujo;
      // la validación final ocurre al enviar el pedido.
    }
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
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            selectedRecipeItemIds: item.selectedRecipeItemIds ?? [],
          })),
          customerName: customerName.trim(),
          customerPhone: phoneCleaned,
          deliveryType,
          address: deliveryType === 'delivery' ? address.trim() : undefined,
          notes: notes.trim() || undefined,
          idempotencyKey: nanoid(),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al crear el pedido');
      }

      const { order, whatsappUrl } = (await response.json()) as {
        order: CreatedOrder;
        whatsappUrl: string | null;
      };

      setCreatedOrder({ ...order, whatsappUrl });
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
      setCheckoutError(err instanceof Error ? err.message : 'Error desconocido');
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
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? 'Error al cancelar el pedido');
      }

      setSuccessDialogOpen(false);
      setCreatedOrder(null);
      setCancellationReason('');
    } catch (err) {
      setCancellationError(
        err instanceof Error ? err.message : 'Error desconocido'
      );
    } finally {
      setIsCancelling(false);
    }
  }

  function handleOpenWhatsApp() {
    if (!createdOrder?.whatsappUrl) return;

    window.open(
      createdOrder.whatsappUrl,
      '_blank',
      'noopener,noreferrer'
    );
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
    breakdownByProduct,
    isCheckingAvailability,

    checkoutOpen,
    setCheckoutOpen,
    branchStatus,
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

    handleBranchChange,
    handleOpenCheckout,
    handleSubmitCheckout,
    handleCancelOrder,
    handleOpenWhatsApp,
    handleGoToChat,
  };
}
