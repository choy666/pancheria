'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { authenticatedFetch, throwApiError } from '@/lib/fetch';
import { REPORTES_VENTAS_API } from '@/config/api';
import { formatMoney } from '@/lib/money';
import { formatDateTime } from '@/lib/date';
import { buildSalesReportCsv } from '@/lib/report-csv';
import type { SalesReport } from '@/application/services/reportService';

function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgoKey(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ReportesClient() {
  const defaultStart = daysAgoKey(30);
  const defaultEnd = todayKey();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  // Rango efectivamente consultado: el formulario solo aplica al confirmar.
  const [appliedRange, setAppliedRange] = useState({
    start: defaultStart,
    end: defaultEnd,
  });
  const [report, setReport] = useState<SalesReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      start: appliedRange.start,
      end: appliedRange.end,
    });

    authenticatedFetch(`${REPORTES_VENTAS_API}?${params}`)
      .then(async (response) => {
        if (!response.ok) {
          await throwApiError(response, 'Error al cargar el reporte');
        }
        return (await response.json()) as SalesReport;
      })
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setIsLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setReport(null);
        setError(e instanceof Error ? e.message : 'Error al cargar el reporte');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appliedRange]);

  function exportCsv() {
    if (!report) return;
    const csv = '﻿' + buildSalesReportCsv(report);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-ventas-${start}_a_${end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setIsLoading(true);
          setAppliedRange({ start, end });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="reporte-start">Desde</Label>
          <Input
            id="reporte-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reporte-end">Hasta</Label>
          <Input
            id="reporte-end"
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Cargando…' : 'Consultar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={exportCsv}
          disabled={!report || isLoading}
        >
          Exportar CSV
        </Button>
      </form>

      {error && (
        <p className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total vendido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  data-testid="reporte-total"
                  className="font-mono text-2xl font-bold text-primary"
                >
                  {formatMoney(report.totals.total)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Efectivo / Transferencia
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-lg">
                <p>{formatMoney(report.totals.cashTotal)}</p>
                <p>{formatMoney(report.totals.transferTotal)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ventas / Anuladas
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-lg">
                <p data-testid="reporte-sales-count">{report.totals.salesCount}</p>
                <p className="text-muted-foreground">
                  {report.totals.cancelledSalesCount} anuladas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Diferencia de arqueo
                </CardTitle>
              </CardHeader>
              <CardContent className="font-mono text-lg">
                <p>Efvo: {formatMoney(report.totals.cashDifference)}</p>
                <p>Transf: {formatMoney(report.totals.transferDifference)}</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="reporte-por-dia">
            <CardHeader>
              <CardTitle className="text-lg">Ventas por día</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Efectivo</TableHead>
                    <TableHead className="text-right">Transferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byDay.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Sin ventas en el período.
                      </TableCell>
                    </TableRow>
                  )}
                  {report.byDay.map((day) => (
                    <TableRow key={day.date} data-testid="reporte-dia">
                      <TableCell>{day.date}</TableCell>
                      <TableCell className="text-right font-mono">
                        {day.salesCount}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(day.total)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(day.cashTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(day.transferTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card data-testid="reporte-por-producto">
            <CardHeader>
              <CardTitle className="text-lg">Ventas por producto</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byProduct.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">
                        Sin ventas en el período.
                      </TableCell>
                    </TableRow>
                  )}
                  {report.byProduct.map((product) => (
                    <TableRow key={product.name} data-testid="reporte-producto">
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {product.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(product.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card data-testid="reporte-cajas">
            <CardHeader>
              <CardTitle className="text-lg">
                Cajas del período ({report.totals.cashRegistersCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Caja</TableHead>
                    <TableHead>Apertura</TableHead>
                    <TableHead>Cierre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ventas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Dif. efectivo</TableHead>
                    <TableHead className="text-right">Dif. transf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.cashRegisters.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground">
                        Sin cajas abiertas en el período.
                      </TableCell>
                    </TableRow>
                  )}
                  {report.cashRegisters.map((cr) => (
                    <TableRow key={cr.id} data-testid="reporte-caja">
                      <TableCell>#{cr.id}</TableCell>
                      <TableCell>{formatDateTime(cr.openedAt)}</TableCell>
                      <TableCell>{formatDateTime(cr.closedAt)}</TableCell>
                      <TableCell>
                        {cr.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {cr.totalSales}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(cr.total)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {cr.closingDifference === null
                          ? '-'
                          : formatMoney(cr.closingDifference)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {cr.closingTransferDifference === null
                          ? '-'
                          : formatMoney(cr.closingTransferDifference)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
