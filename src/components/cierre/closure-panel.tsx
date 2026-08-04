'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        const response = await fetch(`/api/cierre?date=${date}`);
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
      const response = await fetch('/api/cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={isSubmitting}>
          {isSubmitting ? 'Generando...' : 'Generar cierre'}
        </Button>
      </div>

      {closure && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de caja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-bold">
                Total: ${closure.total.toFixed(2)}
              </p>
              <p>Efectivo: ${closure.cashTotal.toFixed(2)}</p>
              <p>Transferencia: ${closure.transferTotal.toFixed(2)}</p>
              <p>Ventas: {closure.totalSales}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {Object.entries(productsSummary).map(([name, quantity]) => (
                  <li key={name} className="flex justify-between">
                    <span>{name}</span>
                    <span className="font-medium">{quantity}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consumo de insumos críticos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {Object.entries(criticalSuppliesSummary).map(([name, quantity]) => (
                  <li key={name} className="flex justify-between">
                    <span>{name}</span>
                    <span className="font-medium">{quantity}</span>
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
