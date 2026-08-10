import { notFound } from 'next/navigation';
import Link from 'next/link';
import { intervalToDuration } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as cashRegisterService from '@/application/services/cashRegisterService';
import { formatDateTime, safeFormatDuration } from '@/lib/date';
import { safeJsonParse } from '@/lib/json';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CashRegisterDetailPage({ params }: Props) {
  const { id } = await params;
  const cashRegister = await cashRegisterService.getCashRegisterById(Number(id));

  if (!cashRegister) {
    notFound();
  }

  const isOpen = cashRegister.status === 'open';
  const openedAt = cashRegister.openedAt;
  const closedAt = cashRegister.closedAt
    ? new Date(cashRegister.closedAt)
    : null;

  const duration =
    closedAt ? intervalToDuration({ start: openedAt, end: closedAt }) : null;

  const productsSummary = safeJsonParse<Record<string, number>>(
    cashRegister.productsSummary,
    {}
  );
  const criticalSuppliesSummary = safeJsonParse<Record<string, number>>(
    cashRegister.criticalSuppliesSummary,
    {}
  );

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
        <Link href="/cierre/historial" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            Volver al historial
          </Button>
        </Link>
      </div>

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
              Duración: {safeFormatDuration(duration, 'En curso')}
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
    </div>
  );
}
