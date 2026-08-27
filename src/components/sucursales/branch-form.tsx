'use client';

import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useTransition,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { type BranchState } from '@/app/(panel)/sucursales/actions';
import type { BranchOpeningHours } from '@/domain/types';

interface Branch {
  id: number;
  name: string;
  openingHours: BranchOpeningHours[];
}

type Slot = BranchOpeningHours & { _id: string };

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

function generateSlotId(): string {
  return `slot-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function BranchForm({
  branch,
  onCancel,
  createBranchAction,
  updateBranchAction,
}: BranchFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<BranchState>(null);

  const initialHours = useMemo<Slot[]>(
    () =>
      branch?.openingHours && branch.openingHours.length > 0
        ? branch.openingHours.map((h) => ({ ...h, _id: generateSlotId() }))
        : [],
    [branch]
  );

  const [openingHours, setOpeningHours] = useState<Slot[]>(initialHours);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!formRef.current) return;

      const formData = new FormData(formRef.current);
      const action = branch ? updateBranchAction : createBranchAction;

      startTransition(async () => {
        const result = await action(state, formData);
        setState(result);

        if (result === null) {
          formRef.current?.reset();
          setOpeningHours([]);
          if (branch) {
            onCancel?.();
          }
        }
      });
    },
    [branch, createBranchAction, updateBranchAction, onCancel, state]
  );

  const isEditing = !!branch;

  function getSlotsForDay(dayOfWeek: number): Slot[] {
    return openingHours
      .filter((slot) => slot.dayOfWeek === dayOfWeek)
      .sort((a, b) => minutesOf(a.open) - minutesOf(b.open));
  }

  function isDayEnabled(dayOfWeek: number): boolean {
    return getSlotsForDay(dayOfWeek).length > 0;
  }

  function addSlot(dayOfWeek: number) {
    setOpeningHours((prev) => [
      ...prev,
      { dayOfWeek, open: '08:00', close: '18:00', _id: generateSlotId() },
    ]);
  }

  function removeSlot(slotId: string) {
    setOpeningHours((prev) => prev.filter((slot) => slot._id !== slotId));
  }

  function updateSlot(
    slotId: string,
    field: 'open' | 'close',
    value: string
  ) {
    setOpeningHours((prev) =>
      prev.map((slot) =>
        slot._id === slotId ? { ...slot, [field]: value } : slot
      )
    );
  }

  function toggleDay(dayOfWeek: number, enabled: boolean) {
    if (enabled) {
      if (!isDayEnabled(dayOfWeek)) {
        addSlot(dayOfWeek);
      }
    } else {
      setOpeningHours((prev) =>
        prev.filter((slot) => slot.dayOfWeek !== dayOfWeek)
      );
    }
  }

  function handleClearDay(dayOfWeek: number) {
    setOpeningHours((prev) =>
      prev.filter((slot) => slot.dayOfWeek !== dayOfWeek)
    );
  }

  return (
    <form
      ref={formRef}
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
          Marcá los días y agregá una o más franjas horarias en las que la
          sucursal atiende pedidos.
        </p>
        <div className="space-y-4">
          {DAYS.map((day, dayOfWeek) => {
            const slots = getSlotsForDay(dayOfWeek);
            const enabled = isDayEnabled(dayOfWeek);

            return (
              <div
                key={dayOfWeek}
                className="rounded-lg border border-white/8 p-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    id={`day-${dayOfWeek}`}
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => toggleDay(dayOfWeek, e.target.checked)}
                    className="h-4 w-4 rounded border-primary"
                  />
                  <Label
                    htmlFor={`day-${dayOfWeek}`}
                    className="flex-1 font-medium"
                  >
                    {day}
                  </Label>
                  {enabled && slots.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClearDay(dayOfWeek)}
                      className="h-auto px-2 py-1 text-xs text-destructive"
                    >
                      <Trash2 className="mr-1 size-3" />
                      Limpiar
                    </Button>
                  )}
                </div>

                {enabled && (
                  <div className="mt-3 space-y-2 pl-7">
                    {slots.map((slot, slotIndex) => (
                      <div key={slot._id} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={slot.open}
                          onChange={(e) =>
                            updateSlot(slot._id, 'open', e.target.value)
                          }
                          name={`openingHours[${dayOfWeek}][${slotIndex}][open]`}
                          className="w-28"
                          aria-label={`Apertura ${day} franja ${slotIndex + 1}`}
                        />
                        <span className="text-muted-foreground">a</span>
                        <Input
                          type="time"
                          value={slot.close}
                          onChange={(e) =>
                            updateSlot(slot._id, 'close', e.target.value)
                          }
                          name={`openingHours[${dayOfWeek}][${slotIndex}][close]`}
                          className="w-28"
                          aria-label={`Cierre ${day} franja ${slotIndex + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSlot(slot._id)}
                          className="size-8 text-destructive"
                          aria-label={`Eliminar franja ${slotIndex + 1} de ${day}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSlot(dayOfWeek)}
                      className="mt-2"
                    >
                      <Plus className="mr-1 size-4" />
                      Agregar franja
                    </Button>
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
