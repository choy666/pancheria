'use client';

import { addHours, intervalToDuration } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAutoCloseHours } from '@/config/caja';
import { formatDateTime, safeFormatDuration } from '@/lib/date';

interface CashRegisterSummaryData {
  id: number;
  openedAt: Date | string;
  closedAt: Date | string | null;
  openedBy: string;
  closedBy: string | null;
  status: 'open' | 'closed';
  autoClosed: boolean;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  productsSummary?: Record<string, number> | null;
  criticalSuppliesSummary?: Record<string, number> | null;
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

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">Resumen de caja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
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
          <p className="font-mono text-2xl font-bold text-primary">
            Total: ${cashRegister.total.toFixed(2)}
          </p>
          <div className="grid grid-cols-2 gap-3 text-base">
            <p className="rounded-lg bg-muted/30 p-3">
              Efectivo:{' '}
              <span className="font-mono font-medium">
                ${cashRegister.cashTotal.toFixed(2)}
              </span>
            </p>
            <p className="rounded-lg bg-muted/30 p-3">
              Transferencia:{' '}
              <span className="font-mono font-medium">
                ${cashRegister.transferTotal.toFixed(2)}
              </span>
            </p>
          </div>
          <p className="text-base">
            Ventas:{' '}
            <span className="font-mono font-semibold">
              {cashRegister.totalSales}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Productos vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {Object.entries(productsSummary).map(([name, quantity]) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-lg bg-muted/20 p-2"
              >
                <span>{name}</span>
                <span className="font-mono font-medium">{quantity}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consumo de insumos críticos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {Object.entries(criticalSuppliesSummary).map(([name, quantity]) => (
              <li
                key={name}
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
