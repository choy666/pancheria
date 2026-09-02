'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch } from '@/lib/fetch';
import { PRODUCTOS_ELIMINADAS_API } from '@/config/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { startOfDayUTC, endOfDayUTC, nowUTC } from '@/lib/date';
import { subDays } from 'date-fns';

export function ProductTrashEmptyButton() {
  const router = useRouter();
  const { dialog, confirm } = useConfirmDialog();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    deleted: number;
    skipped: Array<{ id: number; name: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = nowUTC();
  const [startDate, setStartDate] = useState<string>(
    startOfDayUTC(subDays(now, 30)).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    endOfDayUTC(now).toISOString().slice(0, 10)
  );

  async function handleEmptyTrash() {
    const shouldEmpty = await confirm({
      title: 'Vaciar papelera',
      description:
        '¿Eliminar definitivamente todos los productos en el rango seleccionado? Los que tengan ventas, pedidos o movimientos se omitirán.',
      confirmLabel: 'Vaciar',
      cancelLabel: 'Cancelar',
    });

    if (!shouldEmpty) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const start = startOfDayUTC(startDate).toISOString();
      const end = endOfDayUTC(endDate).toISOString();

      const response = await authenticatedFetch(
        `${PRODUCTOS_ELIMINADAS_API}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || 'Error al vaciar la papelera');
      }

      const data = (await response.json()) as {
        deleted: number;
        skipped: Array<{ id: number; name: string }>;
      };
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-white/8 bg-card p-4">
      {dialog}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="trash-start">Desde</Label>
          <Input
            id="trash-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trash-end">Hasta</Label>
          <Input
            id="trash-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={handleEmptyTrash}
          disabled={isLoading}
          data-testid="empty-trash"
          className="w-full sm:w-auto"
        >
          {isLoading ? 'Vaciando...' : 'Vaciar papelera'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div data-testid="trash-result" className="text-sm text-muted-foreground">
          <p>
            Productos eliminados:{' '}
            <span
              data-testid="trash-deleted-count"
              className="font-mono font-medium text-foreground"
            >
              {result.deleted}
            </span>
          </p>
          {result.skipped.length > 0 && (
            <div className="mt-2">
              <p className="text-destructive">
                Omitidos por tener historial ({result.skipped.length}):
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {result.skipped.map((item) => (
                  <li key={item.id}>{item.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
