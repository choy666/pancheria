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
import { usePedidoClient } from './usePedidoClient';
import { PromoOptionsDialog } from '@/components/promo/promo-options-dialog';
import {
  getTodayOpening,
  getNextOpening,
  formatOpeningHours,
} from '@/lib/branch-helpers';
import type { Branch } from '@/domain/types';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { BranchStatus } from './usePedidoClient';

interface BranchInfoCardProps {
  branchStatus: BranchStatus | null;
  activeBranch: Branch;
}

function BranchInfoCard({ branchStatus, activeBranch }: BranchInfoCardProps) {
  const isStatusKnown = branchStatus !== null;
  const currentOpening =
    branchStatus?.currentOpening ?? getTodayOpening(activeBranch);
  const nextOpening =
    branchStatus?.nextOpening ?? getNextOpening(activeBranch);
  const isOpen = branchStatus?.isOpen ?? false;
  const branch = branchStatus?.branch ?? activeBranch;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border p-3 text-sm">
        <p className="font-medium text-foreground">{branch.name}</p>
        {isStatusKnown ? (
          <p
            className={`mt-1 flex items-center gap-1 ${
              isOpen ? 'text-green-400' : 'text-amber-400'
            }`}
          >
            <span
              className={`inline-block size-2 rounded-full ${
                isOpen ? 'bg-green-400' : 'bg-amber-400'
              }`}
            />
            {isOpen ? 'Abierto ahora' : 'Cerrado'}
            {!isOpen && nextOpening && ` · Próxima apertura: ${nextOpening}`}
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-muted-foreground">
            <span className="inline-block size-2 animate-pulse rounded-full bg-muted-foreground" />
            Consultando disponibilidad...
          </p>
        )}
        <p className="mt-1 text-muted-foreground">
          Horario de hoy: {currentOpening}
        </p>
        {branch.openingHours && branch.openingHours.length > 0 && (
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Ver todos los horarios</summary>
            <p className="pt-1">
              {formatOpeningHours(branch.openingHours)}
            </p>
          </details>
        )}
        {branch.address && (
          <p className="mt-1 text-muted-foreground">
            Dirección: {branch.address}
          </p>
        )}
        {branch.phone && (
          <p className="mt-1 text-muted-foreground">
            Teléfono: {branch.phone}
          </p>
        )}
        {branch.location && (
          <a
            href={branch.location}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-primary hover:underline"
          >
            Ver en mapa
          </a>
        )}
      </div>

      {isStatusKnown && !isOpen && (
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
          role="alert"
        >
          La sucursal está cerrada. Tu pedido se preparará cuando abra:{' '}
          {nextOpening}.
        </div>
      )}

      {isStatusKnown && isOpen && (
        <div
          className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200"
          role="status"
        >
          Sucursal abierta. {currentOpening}.
        </div>
      )}
    </div>
  );
}

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
    recentOrders,
    removeRecentOrder,
    groupedProducts,
    products,
    isActiveBranchValid,
    editingLine,
    startEditLine,
    cancelEditLine,
    confirmEditLine,
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
        inCartQuantityByProduct={inCartQuantityByProduct}
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
            onEditLine={startEditLine}
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

          <BranchInfoCard
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
        onWhatsApp={handleOpenWhatsApp}
        onGoToChat={handleGoToChat}
      />
    </div>
  );
}
