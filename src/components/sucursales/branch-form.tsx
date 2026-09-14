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
import { SOCIAL_NETWORK_OPTIONS } from '@/lib/branch-helpers';
import type {
  Branch,
  BranchOpeningHours,
  BranchSocialNetwork,
} from '@/domain/types';

type Slot = BranchOpeningHours & { _id: string };
type PhoneRow = { _id: string; label: string; number: string };
type SocialRow = { _id: string; network: BranchSocialNetwork; url: string };

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
  const [phones, setPhones] = useState<PhoneRow[]>(
    () =>
      branch?.phones?.map((p) => ({ ...p, _id: generateSlotId() })) ?? []
  );
  const [socialLinks, setSocialLinks] = useState<SocialRow[]>(
    () =>
      branch?.socialLinks?.map((s) => ({ ...s, _id: generateSlotId() })) ?? []
  );

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
          setPhones([]);
          setSocialLinks([]);
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

  function addPhone() {
    setPhones((prev) => [
      ...prev,
      { _id: generateSlotId(), label: '', number: '' },
    ]);
  }

  function removePhone(rowId: string) {
    setPhones((prev) => prev.filter((row) => row._id !== rowId));
  }

  function updatePhone(rowId: string, field: 'label' | 'number', value: string) {
    setPhones((prev) =>
      prev.map((row) => (row._id === rowId ? { ...row, [field]: value } : row))
    );
  }

  function addSocialLink() {
    setSocialLinks((prev) => [
      ...prev,
      { _id: generateSlotId(), network: 'instagram', url: '' },
    ]);
  }

  function removeSocialLink(rowId: string) {
    setSocialLinks((prev) => prev.filter((row) => row._id !== rowId));
  }

  function updateSocialLink(
    rowId: string,
    field: 'network' | 'url',
    value: string
  ) {
    setSocialLinks((prev) =>
      prev.map((row) =>
        row._id === rowId
          ? {
              ...row,
              [field]:
                field === 'network'
                  ? (value as BranchSocialNetwork)
                  : value,
            }
          : row
      )
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      data-testid="branch-form"
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
          data-testid="branch-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección (opcional)</Label>
        <Input
          id="address"
          name="address"
          type="text"
          defaultValue={branch?.address ?? ''}
          placeholder="Ej: Av. Pellegrini 1234, Rosario"
          data-testid="branch-address"
        />
      </div>

      <div className="space-y-2">
        <Label>Teléfonos (opcional)</Label>
        <p className="text-sm text-muted-foreground">
          Agregá uno o más números con su etiqueta, por ejemplo
          &quot;Pedidos&quot; o &quot;WhatsApp&quot;. Se muestran en el catálogo
          público.
        </p>
        <div className="space-y-2">
          {phones.map((phone, index) => (
            <div key={phone._id} className="flex items-center gap-2">
              <Input
                type="text"
                value={phone.label}
                onChange={(e) =>
                  updatePhone(phone._id, 'label', e.target.value)
                }
                name={`phones[${index}][label]`}
                placeholder="Etiqueta"
                aria-label={`Etiqueta del teléfono ${index + 1}`}
                data-testid={`branch-phone-label-${index}`}
                className="w-32"
              />
              <Input
                type="text"
                value={phone.number}
                onChange={(e) =>
                  updatePhone(phone._id, 'number', e.target.value)
                }
                name={`phones[${index}][number]`}
                placeholder="Ej: 3415555555"
                aria-label={`Número del teléfono ${index + 1}`}
                data-testid={`branch-phone-number-${index}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={`branch-remove-phone-${index}`}
                onClick={() => removePhone(phone._id)}
                className="size-8 text-destructive"
                aria-label={`Eliminar teléfono ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="branch-add-phone"
          onClick={addPhone}
        >
          <Plus className="mr-1 size-4" />
          Agregar teléfono
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Ubicación (opcional)</Label>
        <Input
          id="location"
          name="location"
          type="text"
          defaultValue={branch?.location ?? ''}
          placeholder="URL del mapa o coordenadas"
          data-testid="branch-location"
        />
      </div>

      <div className="space-y-2">
        <Label>Redes sociales (opcional)</Label>
        <p className="text-sm text-muted-foreground">
          URL completa (https://...) o nombre de usuario. En WhatsApp, el
          número con código de país. Se muestran en el catálogo público.
        </p>
        <div className="space-y-2">
          {socialLinks.map((link, index) => (
            <div key={link._id} className="flex items-center gap-2">
              <select
                value={link.network}
                onChange={(e) =>
                  updateSocialLink(link._id, 'network', e.target.value)
                }
                name={`socialLinks[${index}][network]`}
                aria-label={`Red social ${index + 1}`}
                data-testid={`branch-social-network-${index}`}
                className="h-11 rounded-lg border border-input bg-input/50 px-3 text-base md:text-sm"
              >
                {SOCIAL_NETWORK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                type="text"
                value={link.url}
                onChange={(e) =>
                  updateSocialLink(link._id, 'url', e.target.value)
                }
                name={`socialLinks[${index}][url]`}
                placeholder="URL o usuario"
                aria-label={`Enlace de la red social ${index + 1}`}
                data-testid={`branch-social-url-${index}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={`branch-remove-social-${index}`}
                onClick={() => removeSocialLink(link._id)}
                className="size-8 text-destructive"
                aria-label={`Eliminar red social ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="branch-add-social"
          onClick={addSocialLink}
        >
          <Plus className="mr-1 size-4" />
          Agregar red social
        </Button>
      </div>

      <div className="space-y-3">
        <Label>Horarios de apertura</Label>
        <p className="text-sm text-muted-foreground">
          Marcá los días y agregá una o más franjas horarias en las que la
          sucursal atiende pedidos. Si el cierre es menor que la apertura, la
          franja termina al día siguiente (ej. 20:00 a 02:00).
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
                    data-testid={`branch-day-${dayOfWeek}-toggle`}
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
                      data-testid={`branch-clear-day-${dayOfWeek}`}
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
                          data-testid={`branch-slot-open-${dayOfWeek}-${slotIndex}`}
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
                          data-testid={`branch-slot-close-${dayOfWeek}-${slotIndex}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          data-testid={`branch-remove-slot-${dayOfWeek}-${slotIndex}`}
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
                      data-testid={`branch-add-slot-${dayOfWeek}`}
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
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="branch-form-error"
        >
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} data-testid="branch-submit">
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
            data-testid="branch-cancel"
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
