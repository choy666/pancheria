'use client';

import { useActionState, useEffect, useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type BranchState } from '@/app/(panel)/sucursales/actions';
import type { BranchOpeningHours } from '@/domain/types';

interface Branch {
  id: number;
  name: string;
  openingHours: BranchOpeningHours[];
}

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

interface BranchFormProps {
  branch?: Branch;
  onCancel?: () => void;
  createBranchAction: (
    _prevState: BranchState,
    formData: FormData
  ) => Promise<BranchState>;
  updateBranchAction: (
    _prevState: BranchState,
    formData: FormData
  ) => Promise<BranchState>;
}

const initialState: BranchState = null;

export function BranchForm({
  branch,
  onCancel,
  createBranchAction,
  updateBranchAction,
}: BranchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasSubmittedRef = useRef(false);
  const action = branch ? updateBranchAction : createBranchAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  const initialHours =
    branch?.openingHours && branch.openingHours.length > 0
      ? branch.openingHours
      : [];

  const [openingHours, setOpeningHours] =
    useState<BranchOpeningHours[]>(initialHours);

  useEffect(() => {
    if (
      hasSubmittedRef.current &&
      !isPending &&
      state === null &&
      formRef.current
    ) {
      hasSubmittedRef.current = false;
      formRef.current.reset();
      setOpeningHours([]);
      if (branch) {
        onCancel?.();
      }
    }
  }, [state, isPending, branch, onCancel]);

  const handleSubmit = useCallback(() => {
    hasSubmittedRef.current = true;
  }, []);

  const isEditing = !!branch;

  const toggleDay = (dayOfWeek: number, enabled: boolean) => {
    setOpeningHours((prev) => {
      if (enabled) {
        if (prev.some((h) => h.dayOfWeek === dayOfWeek)) return prev;
        return [...prev, { dayOfWeek, open: '08:00', close: '18:00' }];
      }
      return prev.filter((h) => h.dayOfWeek !== dayOfWeek);
    });
  };

  const updateDay = (
    dayOfWeek: number,
    field: 'open' | 'close',
    value: string
  ) => {
    setOpeningHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h))
    );
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="max-w-md space-y-5"
    >
      {isEditing && <input type="hidden" name="id" value={branch.id} />}

      <div className="space-y-2">
        <Label htmlFor="name">Nombre de la sucursal</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={branch?.name}
          placeholder="Ej: Sucursal Centro"
        />
      </div>

      <div className="space-y-3">
        <Label>Horarios de apertura</Label>
        <p className="text-sm text-muted-foreground">
          Marcá los días y horarios en los que la sucursal atiende pedidos.
        </p>
        <div className="space-y-3">
          {DAYS.map((day, dayOfWeek) => {
            const hours = openingHours.find((h) => h.dayOfWeek === dayOfWeek);
            const enabled = !!hours;
            return (
              <div key={dayOfWeek} className="flex items-center gap-3">
                <input
                  id={`day-${dayOfWeek}`}
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => toggleDay(dayOfWeek, e.target.checked)}
                  className="h-4 w-4 rounded border-primary"
                />
                <Label htmlFor={`day-${dayOfWeek}`} className="w-24">
                  {day}
                </Label>
                {enabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hours.open}
                      onChange={(e) =>
                        updateDay(dayOfWeek, 'open', e.target.value)
                      }
                      name={`openingHours[${dayOfWeek}][open]`}
                      className="w-28"
                      aria-label={`Apertura ${day}`}
                    />
                    <span className="text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={hours.close}
                      onChange={(e) =>
                        updateDay(dayOfWeek, 'close', e.target.value)
                      }
                      name={`openingHours[${dayOfWeek}][close]`}
                      className="w-28"
                      aria-label={`Cierre ${day}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEditing
              ? 'Guardando...'
              : 'Creando...'
            : isEditing
            ? 'Guardar cambios'
            : 'Crear sucursal'}
        </Button>

        {isEditing && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
