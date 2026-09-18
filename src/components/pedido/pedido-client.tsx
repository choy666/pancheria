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
import { CheckoutSummary } from './checkout-summary';
import { BranchInfoCard } from './branch-info-card';
import { usePedidoClient } from './usePedidoClient';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import { formatMoney } from '@/lib/money';
import { publicShortageMessage } from '@/lib/public-errors';
import type { Branch } from '@/domain/types';
import type { PublicCatalogProduct } from '@/application/services/catalogService';

interface PedidoClientProps {
  branches: Branch[];
  activeBranch: Branch;
  initialProducts: PublicCatalogProduct[];
  initialTotal?: number;
  pageSize?: number;
}

export function PedidoClient({
  branches,
  activeBranch,
  initialProducts,
  initialTotal,
  pageSize,
}: PedidoClientProps) {
  const {
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
    recentOrders,
    removeRecentOrder,
    groupedProducts,
    products,
    isActiveBranchValid,
    hasMore,
    isLoadingMore,
    loadMore,
    editingLine,
    startEditLine,
    cancelEditLine,
    confirmEditLine,
    handleBranchChange,
    handleOpenCheckout,
    handleSubmitCheckout,
    handleCancelOrder,
    handleGoToChat,
  } = usePedidoClient({ branches, activeBranch, initialProducts, initialTotal, pageSize });

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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
          {Object.keys(shortageByProduct).map((productId) => {
            const product = products.find((p) => p.id === Number(productId));
            return (
              <p key={productId}>
                {publicShortageMessage(product?.name)}
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
        branchStatus={branchStatus}
        branchStatusChecked={branchStatusChecked}
        groupedProducts={groupedProducts}
        items={items}
        inCartQuantityByProduct={inCartQuantityByProduct}
        isCheckingAvailability={isCheckingAvailability}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        onBranchChange={handleBranchChange}
        onAdd={addItem}
        cart={
          <PedidoCartSection
            branchName={activeBranch.name}
            items={items}
            total={total}
            shortageByProduct={shortageByProduct}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
            onEditLine={startEditLine}
            onCheckout={handleOpenCheckout}
            disabled={isCheckingAvailability}
            isCheckingAvailability={isCheckingAvailability}
          />
        }
      />

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="checkout-dialog-title">Finalizar pedido</DialogTitle>
            <DialogDescription>
              Completá tus datos para hacer el pedido. El local confirma tu pedido antes de prepararlo.
            </DialogDescription>
            <p
              data-testid="checkout-step-indicator"
              className="text-xs text-muted-foreground"
            >
              Paso 3 de 3 — Completá tus datos
            </p>
          </DialogHeader>

          <BranchInfoCard
            variant="checkout"
            branchStatus={branchStatus}
            activeBranch={activeBranch}
          />

          <CheckoutSummary items={items} total={total} />

          <PedidoCustomerForm
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
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
              data-testid="confirm-order-button"
              disabled={
                items.length === 0 ||
                isSubmitting ||
                isCheckingAvailability ||
                Object.keys(shortageByProduct).length > 0
              }
              onClick={handleSubmitCheckout}
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingLine && (
        <PromoOptionsDialog
          key={editingLine.dialogKey}
          open={editingLine !== null}
          onOpenChange={(open) => {
            if (!open) cancelEditLine();
          }}
          productName={editingLine.product.name}
          productPrice={editingLine.product.price}
          recipe={editingLine.product.recipe ?? []}
          initialSelectedIds={editingLine.initialSelectedIds}
          onConfirm={confirmEditLine}
          mode="edit"
          confirmLabel="Guardar cambios"
        />
      )}

      <PedidoSuccessDialog
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        createdOrder={createdOrder}
        branch={activeBranch}
        cancellationReason={cancellationReason}
        setCancellationReason={setCancellationReason}
        isCancelling={isCancelling}
        cancellationError={cancellationError}
        onCancel={handleCancelOrder}
        onGoToChat={handleGoToChat}
      />

      {items.length > 0 && (
        <>
          {/* Espacio para que la barra fija no tape el contenido en mobile. */}
          <div className="h-16 lg:hidden" aria-hidden="true" />
          <div
            data-testid="mobile-cart-bar"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 p-3 backdrop-blur lg:hidden"
          >
            <Button
              type="button"
              className="w-full"
              onClick={() =>
                document
                  .getElementById('pedido-cart')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              Ver mi pedido · {cartItemCount}{' '}
              {cartItemCount === 1 ? 'ítem' : 'ítems'} · {formatMoney(total)}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
