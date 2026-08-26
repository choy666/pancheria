'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PedidoError } from './pedido-error';
import { RecentOrdersBanner } from './recent-orders-banner';
import { PedidoCatalogSection } from './pedido-catalog-section';
import { PedidoCartSection } from './pedido-cart-section';
import { PedidoCustomerForm } from './pedido-customer-form';
import { PedidoSuccessDialog } from './pedido-success-dialog';
import { usePedidoClient } from './usePedidoClient';
import type { Branch } from '@/domain/types';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface PedidoClientProps {
  branches: Branch[];
  activeBranch: Branch;
  initialProducts: PublicCatalogProduct[];
}

export function PedidoClient({
  branches,
  activeBranch,
  initialProducts,
}: PedidoClientProps) {
  const {
    error,
    shortageByProduct,
    breakdownByProduct,
    isCheckingAvailability,
    checkoutOpen,
    setCheckoutOpen,
    customerName,
    setCustomerName,
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
    addItem,
    removeItem,
    updateQuantity,
    recentOrders,
    removeRecentOrder,
    groupedProducts,
    products,
    isActiveBranchValid,
    handleBranchChange,
    handleOpenCheckout,
    handleSubmitCheckout,
    handleCancelOrder,
    handleOpenWhatsApp,
    handleGoToChat,
  } = usePedidoClient({ branches, activeBranch, initialProducts });

  if (!isActiveBranchValid) {
    return <PedidoError />;
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

      <RecentOrdersBanner
        orders={recentOrders}
        onDismiss={removeRecentOrder}
      />

      <PedidoCatalogSection
        branches={branches}
        activeBranch={activeBranch}
        groupedProducts={groupedProducts}
        items={items}
        breakdownByProduct={breakdownByProduct}
        isCheckingAvailability={isCheckingAvailability}
        onBranchChange={handleBranchChange}
        onAdd={addItem}
        cart={
          <PedidoCartSection
            branchName={activeBranch.name}
            items={items}
            total={total}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
            onCheckout={handleOpenCheckout}
            disabled={isCheckingAvailability}
          />
        }
      />

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar pedido</DialogTitle>
            <DialogDescription>
              Completá tus datos para hacer el pedido. El stock se confirma cuando el operador acepta el pedido.
            </DialogDescription>
          </DialogHeader>

          <PedidoCustomerForm
            customerName={customerName}
            setCustomerName={setCustomerName}
            deliveryType={deliveryType}
            setDeliveryType={setDeliveryType}
            address={address}
            setAddress={setAddress}
            notes={notes}
            setNotes={setNotes}
            checkoutError={checkoutError}
            total={total}
            activeBranch={activeBranch}
          />

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
              {isSubmitting ? 'Procesando...' : 'Confirmar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PedidoSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        createdOrder={createdOrder}
        branchName={activeBranch.name}
        cancellationReason={cancellationReason}
        setCancellationReason={setCancellationReason}
        isCancelling={isCancelling}
        cancellationError={cancellationError}
        onCancel={handleCancelOrder}
        onWhatsApp={handleOpenWhatsApp}
        onGoToChat={handleGoToChat}
      />
    </div>
  );
}
