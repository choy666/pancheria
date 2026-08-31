'use client';

import { addHours, intervalToDuration } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAutoCloseHours } from '@/config/caja';
import { formatMoney } from '@/lib/money';
import { formatDateTime, safeFormatDuration } from '@/lib/date';

interface CashRegisterSummaryData {
  id: number;
  openedAt: Date | string;
  closedAt: Date | string | null;
  openedBy: string;
  closedBy: string | null;
  status: 'open' | 'closed';
  autoClosed: boolean;
  initialAmount: number;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  cashInDrawer?: number | null;
  closingCashCount?: number | null;
  closingDifference?: number | null;
  closingNotes?: string | null;
  productsSummary?: Record<string, number> | null;
  criticalSuppliesSummary?: Record<string, number> | null;
  recipeSuppliesSummary?: Record<string, number> | null;
}

interface CashRegisterSummaryProps {
  cashRegister: CashRegisterSummaryData;
  branchName?: string | null;
  isOpen?: boolean;
}

export function CashRegisterSummary({
  cashRegister,
  branchName,
  isOpen = cashRegister.status === 'open',
}: CashRegisterSummaryProps) {
  const openedAt = new Date(cashRegister.openedAt);
  const closedAt = cashRegister.closedAt
    ? new Date(cashRegister.closedAt)
    : null;
  const now = new Date();

  const duration = intervalToDuration({
    start: openedAt,
    end: closedAt ?? now,
  });

  const remaining = isOpen
    ? intervalToDuration({
        start: now,
        end: addHours(openedAt, getAutoCloseHours()),
      })
    : null;

  const productsSummary = cashRegister.productsSummary ?? {};
  const criticalSuppliesSummary = cashRegister.criticalSuppliesSummary ?? {};
  const recipeSuppliesSummary = cashRegister.recipeSuppliesSummary ?? {};

  const cashInDrawer =
    cashRegister.cashInDrawer ??
    cashRegister.cashTotal + cashRegister.initialAmount;

  const difference = cashRegister.closingDifference;
  const hasDifference = difference !== undefined && difference !== null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Resumen de caja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            className="text-sm text-muted-foreground"
            suppressHydrationWarning
          >
            {branchName && (
              <>
                Sucursal: {branchName}
                <br />
              </>
            )}
            Abierta: {formatDateTime(cashRegister.openedAt)}
            {closedAt && (
              <>
                <br />
                Cerrada: {formatDateTime(cashRegister.closedAt)}
              </>
            )}
            <br />
            Duración: {safeFormatDuration(duration)}
            {isOpen && remaining && (
              <>
                <br />
                Cierre automático en: {safeFormatDuration(remaining)}
              </>
            )}
            <br />
            Abierta por: {cashRegister.openedBy}
            {cashRegister.closedBy && (
              <>
                <br />
                Cerrada por: {cashRegister.closedBy}
              </>
            )}
            {cashRegister.autoClosed && (
              <>
                <br />
                Cierre automático
              </>
            )}
          </p>
          <p
            data-testid="cash-register-total"
            className="font-mono text-2xl font-bold text-primary"
          >
            Total: {formatMoney(cashRegister.total)}
          </p>
          <div className="grid grid-cols-2 gap-3 text-base">
            <p className="rounded-lg bg-muted/30 p-3">
              Efectivo en ventas:{' '}
              <span className="font-mono font-medium">
                {formatMoney(cashRegister.cashTotal)}
              </span>
            </p>
            <p className="rounded-lg bg-muted/30 p-3">
              Transferencia:{' '}
              <span className="font-mono font-medium">
                {formatMoney(cashRegister.transferTotal)}
              </span>
            </p>
            <p className="rounded-lg bg-muted/30 p-3">
              Monto inicial:{' '}
              <span className="font-mono font-medium">
                {formatMoney(cashRegister.initialAmount)}
              </span>
            </p>
            <p className="rounded-lg bg-muted/30 p-3">
              Efectivo en caja:{' '}
              <span className="font-mono font-medium">
                {formatMoney(cashInDrawer)}
              </span>
            </p>
          </div>
          {hasDifference && (
            <p
              className={`rounded-lg p-3 text-base font-medium ${
                difference > 0
                  ? 'bg-green-100 text-green-800'
                  : difference < 0
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted/30'
              }`}
            >
              Diferencia:{' '}
              <span className="font-mono">
                {difference > 0 ? '+' : ''}{formatMoney(difference)}
              </span>
              {difference > 0 ? ' (sobrante)' : difference < 0 ? ' (faltante)' : ' (cuadrado)'}
            </p>
          )}
          {cashRegister.closingCashCount !== undefined && cashRegister.closingCashCount !== null && (
            <p className="text-base">
              Efectivo contado:{' '}
              <span className="font-mono font-semibold">
                {formatMoney(cashRegister.closingCashCount)}
              </span>
            </p>
          )}
          {cashRegister.closingNotes && (
            <p className="text-sm text-muted-foreground">
              Notas: {cashRegister.closingNotes}
            </p>
          )}
          <p className="text-base">
            Ventas:{' '}
            <span className="font-mono font-semibold">
              {cashRegister.totalSales}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card data-testid="products-sold-card">
        <CardHeader>
          <CardTitle className="text-lg">Productos vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {Object.entries(productsSummary).map(([name, quantity]) => (
              <li
                key={name}
                data-testid="cash-register-product-item"
                data-product-name={name}
                className="flex items-center justify-between rounded-lg bg-muted/20 p-2"
              >
                <span>{name}</span>
                <span className="font-mono font-medium">{quantity}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card data-testid="critical-supplies-card">
        <CardHeader>
          <CardTitle className="text-lg">Consumo de insumos críticos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {Object.entries(criticalSuppliesSummary).map(([name, quantity]) => (
              <li
                key={name}
                data-testid="cash-register-supply-item"
                data-supply-name={name}
                className="flex items-center justify-between rounded-lg bg-muted/20 p-2"
              >
                <span>{name}</span>
                <span className="font-mono font-medium">{quantity}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card
        data-testid="recipe-supplies-card"
        role="region"
        aria-labelledby="recipe-supplies-title"
      >
        <CardHeader>
          <CardTitle id="recipe-supplies-title" className="text-lg">
            Insumos de recetas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2" aria-labelledby="recipe-supplies-title">
            {Object.entries(recipeSuppliesSummary).map(([name, quantity]) => (
              <li
                key={name}
                data-testid="cash-register-recipe-supply-item"
                data-supply-name={name}
                className="flex items-center justify-between rounded-lg bg-muted/20 p-2"
              >
                <span>{name}</span>
                <span className="font-mono font-medium">{quantity}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
