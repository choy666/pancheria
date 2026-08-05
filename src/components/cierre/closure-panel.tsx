'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CIERRE_API } from '@/config/api';

interface Closure {
  id: number;
  date: string;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  productsSummary: string;
  criticalSuppliesSummary: string;
}

export function ClosurePanel() {
  const router = useRouter();
  const [date, setDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [closure, setClosure] = useState<Closure | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${CIERRE_API}?date=${date}`, { credentials: 'include' });
        if (response.ok) {
          setClosure((await response.json()) as Closure | null);
        } else {
          setClosure(null);
        }
      } catch {
        setClosure(null);
      }
    }

    load();
  }, [date]);

  async function handleGenerate() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(CIERRE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ date }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al generar cierre');
      }

      setClosure((await response.json()) as Closure);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsSubmitting(false);
    }
  }

  const productsSummary = closure
    ? (JSON.parse(closure.productsSummary) as Record<string, number>)
    : {};
  const criticalSuppliesSummary = closure
    ? (JSON.parse(closure.criticalSuppliesSummary) as Record<string, number>)
    : {};

  function downloadCsv() {
    if (!closure) return;

    const lines: string[] = [];
    lines.push('Fecha', closure.date.split('T')[0]);
    lines.push('Total', closure.total.toFixed(2));
    lines.push('Efectivo', closure.cashTotal.toFixed(2));
    lines.push('Transferencia', closure.transferTotal.toFixed(2));
    lines.push('Ventas', String(closure.totalSales));
    lines.push('');
    lines.push('Producto,Cantidad');
    Object.entries(productsSummary).forEach(([name, quantity]) => {
      lines.push(`${name},${quantity}`);
    });
    lines.push('');
    lines.push('Insumo crítico,Cantidad');
    Object.entries(criticalSuppliesSummary).forEach(([name, quantity]) => {
      lines.push(`${name},${quantity}`);
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cierre-${closure.date.split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-destructive/15 p-4 text-base text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full space-y-2 sm:w-auto">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? 'Generando...' : 'Generar cierre'}
        </Button>
        {closure && (
          <Button variant="outline" onClick={downloadCsv} className="w-full sm:w-auto">
            Descargar CSV
          </Button>
        )}
      </div>

      {closure && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Resumen de caja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-mono text-2xl font-bold text-primary">
                Total: ${closure.total.toFixed(2)}
              </p>
              <div className="grid grid-cols-2 gap-3 text-base">
                <p className="rounded-lg bg-muted/30 p-3">
                  Efectivo: <span className="font-mono font-medium">${closure.cashTotal.toFixed(2)}</span>
                </p>
                <p className="rounded-lg bg-muted/30 p-3">
                  Transferencia: <span className="font-mono font-medium">${closure.transferTotal.toFixed(2)}</span>
                </p>
              </div>
              <p className="text-base">Ventas: <span className="font-mono font-semibold">{closure.totalSales}</span></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Productos vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {Object.entries(productsSummary).map(([name, quantity]) => (
                  <li key={name} className="flex items-center justify-between rounded-lg bg-muted/20 p-2">
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
                  <li key={name} className="flex items-center justify-between rounded-lg bg-muted/20 p-2">
                    <span>{name}</span>
                    <span className="font-mono font-medium">{quantity}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {!closure && !isSubmitting && (
        <p className="text-muted-foreground">
          No hay cierre generado para la fecha seleccionada.
        </p>
      )}
    </div>
  );
}
