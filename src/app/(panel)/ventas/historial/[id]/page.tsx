import { notFound } from 'next/navigation';
import { intervalToDuration } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SalesHistory } from '@/components/ventas/sales-history';
import { CashRegisterDetailActions } from '@/components/caja/cash-register-detail-actions';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { formatDateTime, safeFormatDuration } from '@/lib/date';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function CashRegisterSalesDetailPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { from } = await searchParams;
  const cashRegister = await cashRegisterService.getCashRegisterById(
    Number(id),
    true
  );

  if (!cashRegister) {
    notFound();
  }

  const isOpen = cashRegister.status === 'open' && !cashRegister.deletedAt;
  const fromTrash = from === 'trash';

  // Para cajas abiertas se calcula el resumen en tiempo real.
  const liveSummary = isOpen
    ? await cashRegisterService.calculateCashRegisterSummary(cashRegister.id)
    : null;

  const openedAt = new Date(cashRegister.openedAt);
  const closedAt = cashRegister.closedAt
    ? new Date(cashRegister.closedAt)
    : null;
  const duration = intervalToDuration({
    start: openedAt,
    end: closedAt ?? new Date(),
  });

  const total = liveSummary ? liveSummary.total : cashRegister.total;
  const cashTotal = liveSummary
    ? liveSummary.cashTotal
    : cashRegister.cashTotal;
  const transferTotal = liveSummary
    ? liveSummary.transferTotal
    : cashRegister.transferTotal;
  const totalSales = liveSummary
    ? liveSummary.totalSales
    : cashRegister.totalSales;

  const productsSummary = liveSummary
    ? (JSON.parse(liveSummary.productsSummary) as Record<string, number>)
    : (JSON.parse(cashRegister.productsSummary) as Record<string, number>);

  const criticalSuppliesSummary = liveSummary
    ? (JSON.parse(liveSummary.criticalSuppliesSummary) as Record<string, number>)
    : (JSON.parse(cashRegister.criticalSuppliesSummary) as Record<string, number>);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Caja #{cashRegister.id}
          </h1>
          {isOpen ? (
            <Badge variant="default">Abierta</Badge>
          ) : (
            <Badge variant="secondary">Cerrada</Badge>
          )}
        </div>
        <CashRegisterDetailActions
          cashRegister={{
            id: cashRegister.id,
            status: cashRegister.status,
            deletedAt: cashRegister.deletedAt
              ? cashRegister.deletedAt.toISOString()
              : null,
          }}
          fromTrash={fromTrash}
        />
      </div>

      {cashRegister.deletedAt && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          Esta caja fue eliminada el {formatDateTime(cashRegister.deletedAt)}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Resumen de caja</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Abierta: {formatDateTime(cashRegister.openedAt)}
              {cashRegister.closedAt && (
                <>
                  <br />
                  Cerrada: {formatDateTime(cashRegister.closedAt)}
                </>
              )}
              <br />
              Duración: {isOpen ? 'En curso' : safeFormatDuration(duration)}
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
              Total: ${total.toFixed(2)}
            </p>
            <div className="grid grid-cols-2 gap-3 text-base">
              <p className="rounded-lg bg-muted/30 p-3">
                Efectivo:{' '}
                <span className="font-mono font-medium">
                  ${cashTotal.toFixed(2)}
                </span>
              </p>
              <p className="rounded-lg bg-muted/30 p-3">
                Transferencia:{' '}
                <span className="font-mono font-medium">
                  ${transferTotal.toFixed(2)}
                </span>
              </p>
            </div>
            <p className="text-base">
              Ventas:{' '}
              <span className="font-mono font-semibold">{totalSales}</span>
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

      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">Ventas de la caja</h2>
        <SalesHistory
          sales={cashRegister.sales ?? []}
          allowCancel={!cashRegister.deletedAt}
        />
      </div>
    </div>
  );
}
