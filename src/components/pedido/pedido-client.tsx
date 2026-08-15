'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { groupPublicProductsByType } from '@/lib/catalog';
import {
  productTypeGroupClasses,
  productTypeLabels,
} from '@/lib/product-style';
import { type PublicOrderItem } from '@/lib/whatsapp';
import { getPedidoRefetchIntervalMs } from '@/config/catalog';
import {
  PUBLIC_CATALOGO_API,
  PUBLIC_DISPONIBILIDAD_API,
  PUBLIC_PEDIDO_API,
  PUBLIC_PEDIDO_CANCELAR_API,
} from '@/config/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductCard } from './product-card';
import { CartSummary } from './cart-summary';
import { useCart } from '@/hooks/useCart';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface PedidoClientProps {
  initialProducts: PublicCatalogProduct[];
  branchId: number;
}

interface ShortageInfo {
  available: number;
  required: number;
  supplyName: string;
}

interface CreatedOrder {
  id: number;
  orderNumber: string;
  status: string;
  total: number;
  customerName: string;
  deliveryType: 'delivery' | 'pickup';
  address: string | null;
  notes: string | null;
  cancellationToken: string;
  items: PublicOrderItem[];
  createdAt: string;
  whatsappUrl: string;
}

export function PedidoClient({ initialProducts, branchId }: PedidoClientProps) {
  const isMountedRef = useRef(true);
  const [products, setProducts] = useState<PublicCatalogProduct[]>(
    initialProducts
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortageByProduct, setShortageByProduct] = useState<
    Record<number, ShortageInfo>
  >({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>(
    'pickup'
  );
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(
    null
  );

  const getAvailability = useCallback(
    (productId: number) => {
      const product = products.find((p) => p.id === productId);
      return product?.availability ?? 0;
    },
    [products]
  );

  const { items, total, addItem, removeItem, updateQuantity, clearCart } =
    useCart({
      branchId,
      products,
      getAvailability,
    });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Carga inicial con disponibilidad actualizada en caso de que el SSR tenga datos de caché.
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${PUBLIC_CATALOGO_API}?branchId=${branchId}&includeAvailability=true`
        );
        if (!response.ok) throw new Error('Error al cargar el catálogo');

        const data = (await response.json()) as PublicCatalogProduct[];
        if (!isMountedRef.current) return;
        setProducts(data);
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    }

    void load();
  }, [branchId]);

  // Refresco periódico de disponibilidad.
  useEffect(() => {
    const intervalMs = getPedidoRefetchIntervalMs();

    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${PUBLIC_CATALOGO_API}?branchId=${branchId}&includeAvailability=true`
        );
        if (!response.ok) throw new Error('Error al refrescar el catálogo');

        const data = (await response.json()) as PublicCatalogProduct[];
        if (!isMountedRef.current) return;
        setProducts(data);
      } catch {
        // No saturar la UI con errores de fondo.
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [branchId]);

  // Validación de disponibilidad del carrito.
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
          `${PUBLIC_DISPONIBILIDAD_API}?branchId=${branchId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: items.map((item) => ({
                productId: item.id,
                quantity: item.quantity,
              })),
              productIds: products.map((p) => p.id),
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
        };

        if (!isMountedRef.current) return;
        setShortageByProduct(data.shortageByProduct ?? {});
      } catch (err) {
        if (!isMountedRef.current) return;
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (isMountedRef.current) setIsCheckingAvailability(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [items, products, branchId]);

  const groupedProducts = groupPublicProductsByType(products);

  const inCartIds = new Set(items.map((item) => item.id));

  function handleOpenCheckout() {
    setCheckoutOpen(true);
    setCheckoutError(null);
  }

  async function handleSubmitCheckout() {
    setCheckoutError(null);

    if (!customerName.trim()) {
      setCheckoutError('El nombre del cliente es obligatorio.');
      return;
    }

    if (deliveryType === 'delivery' && !address.trim()) {
      setCheckoutError('La dirección de envío es obligatoria.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${PUBLIC_PEDIDO_API}?branchId=${branchId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customerName: customerName.trim(),
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
        whatsappUrl: string;
      };

      setCreatedOrder({ ...order, whatsappUrl });
      setSuccessDialogOpen(true);
      setCheckoutOpen(false);
      clearCart();
      setCustomerName('');
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
        `${PUBLIC_PEDIDO_CANCELAR_API(createdOrder.id)}?branchId=${branchId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason:
              cancellationReason.trim() || 'Cancelado por el cliente',
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
    if (!createdOrder) return;
    window.open(
      createdOrder.whatsappUrl,
      '_blank',
      'noopener,noreferrer'
    );
  }

  if (loading && products.length === 0) {
    return <div className="text-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      {Object.keys(shortageByProduct).length > 0 && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {Object.entries(shortageByProduct).map(([productId, shortage]) => {
            const product = products.find((p) => p.id === Number(productId));
            return (
              <p key={productId}>
                Faltan insumos para {product?.name ?? 'producto'}:{' '}
                {shortage.supplyName} (disponible {shortage.available},
                requerido {shortage.required}).
              </p>
            );
          })}
        </div>
      )}

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
                    onAdd={() => addItem(product)}
                    disabled={isCheckingAvailability}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <CartSummary
            items={items}
            total={total}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
            onCheckout={handleOpenCheckout}
            disabled={isCheckingAvailability}
          />
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar pedido</DialogTitle>
            <DialogDescription>
              Completá tus datos para reservar el pedido y enviarlo por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {checkoutError && (
              <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
                {checkoutError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="customerName">Nombre</Label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliveryType">Tipo de entrega</Label>
              <Select
                value={deliveryType}
                onValueChange={(value) =>
                  setDeliveryType(value as 'delivery' | 'pickup')
                }
              >
                <SelectTrigger id="deliveryType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Envío a domicilio</SelectItem>
                  <SelectItem value="pickup">Retiro en sucursal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deliveryType === 'delivery' && (
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Dirección de envío"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentarios sobre el pedido"
              />
            </div>

            <div className="border-t border-white/10 pt-3">
              <p className="font-mono text-xl font-bold">
                Total: ${total.toFixed(2)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCheckoutOpen(false)}
              disabled={isSubmitting}
            >
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={
                items.length === 0 ||
                isSubmitting ||
                isCheckingAvailability
              }
              onClick={handleSubmitCheckout}
            >
              {isSubmitting ? 'Reservando...' : 'Reservar y abrir WhatsApp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedido {createdOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              El pedido se reservó correctamente. Abrí WhatsApp para enviarlo, o
              cancelalo si te equivocaste.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {cancellationError && (
              <div className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
                {cancellationError}
              </div>
            )}

            {createdOrder && (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Cliente:{' '}
                  <span className="text-foreground">
                    {createdOrder.customerName}
                  </span>
                </p>
                <p>
                  Total:{' '}
                  <span className="font-mono text-foreground">
                    ${createdOrder.total.toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">
                Motivo de cancelación (opcional)
              </Label>
              <Textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Por qué querés cancelar el pedido"
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={isCancelling || !createdOrder}
              className="w-full sm:w-auto"
            >
              {isCancelling ? 'Cancelando...' : 'Cancelar pedido'}
            </Button>
            <Button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!createdOrder}
              className="w-full sm:w-auto"
            >
              Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
