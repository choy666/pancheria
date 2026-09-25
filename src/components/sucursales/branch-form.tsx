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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardPaste, Copy, Plus, Trash2, X } from 'lucide-react';
import { type BranchState } from '@/app/(panel)/sucursales/actions';
import {
  SOCIAL_NETWORK_OPTIONS,
  getSocialNetworkLabel,
  isValidPhoneNumber,
  isValidSocialTarget,
  minutesOf,
  validateOpeningHours,
} from '@/lib/branch-helpers';
import { describeLocationInput } from '@/lib/maps';
import { BranchLocationPreview } from '@/components/sucursales/branch-location-preview';
import type {
  Branch,
  BranchOpeningHours,
  BranchSocialNetwork,
} from '@/domain/types';

type Slot = BranchOpeningHours & { _id: string };
type PhoneRow = { _id: string; label: string; number: string };
type SocialRow = { _id: string; network: BranchSocialNetwork; url: string };

/** Snapshot de franjas copiadas para pegar en otro día (sin `_id`). */
type CopiedHours = {
  dayOfWeek: number;
  slots: { open: string; close: string }[];
};

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

  // Validación en vivo: el estado derivado se calcula con useMemo (regla del
  // proyecto: no usar useEffect + setState para derivar estado).
  const [nameInput, setNameInput] = useState(branch?.name ?? '');
  const [locationInput, setLocationInput] = useState(branch?.location ?? '');
  // Los errores por campo solo se muestran tras tocar el input (onBlur) o tras
  // un intento de submit, para no flashear "inválido" en cada keystroke.
  const [nameTouched, setNameTouched] = useState(false);
  const [locationTouched, setLocationTouched] = useState(false);
  const [copied, setCopied] = useState<CopiedHours | null>(null);

  const locationDesc = useMemo(
    () => describeLocationInput(locationInput),
    [locationInput]
  );
  const showLocationError =
    locationTouched && locationDesc.status === 'invalid';
  const showNameError = nameTouched && !nameInput.trim();

  const hoursError = useMemo(() => {
    try {
      validateOpeningHours(openingHours);
      return null;
    } catch (error) {
      return error instanceof Error
        ? error.message
        : 'Revisá los horarios de apertura.';
    }
  }, [openingHours]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!formRef.current) return;

      // Un intento de submit destapa los errores inline aunque el campo no se
      // haya tocado; el servidor sigue siendo la fuente de verdad.
      setNameTouched(true);
      setLocationTouched(true);

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
          setNameInput('');
          setNameTouched(false);
          setLocationInput('');
          setLocationTouched(false);
          setCopied(null);
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

  function handleCopyDay(dayOfWeek: number) {
    const slots = getSlotsForDay(dayOfWeek).map(({ open, close }) => ({
      open,
      close,
    }));
    if (slots.length === 0) return;
    setCopied({ dayOfWeek, slots });
  }

  // Pegar reemplaza las franjas del día destino por las copiadas y habilita
  // el día si estaba apagado (acción explícita del usuario).
  function handlePasteDay(dayOfWeek: number) {
    if (!copied) return;
    const slots = copied.slots;
    setOpeningHours((prev) => [
      ...prev.filter((slot) => slot.dayOfWeek !== dayOfWeek),
      ...slots.map((slot) => ({
        dayOfWeek,
        open: slot.open,
        close: slot.close,
        _id: generateSlotId(),
      })),
    ]);
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
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={() => setNameTouched(true)}
          placeholder="Ej: Sucursal Centro"
          data-testid="branch-name"
          aria-invalid={showNameError}
          aria-describedby={showNameError ? 'branch-name-error' : undefined}
        />
        {showNameError && (
          <p
            id="branch-name-error"
            role="alert"
            className="text-sm text-destructive"
            data-testid="branch-name-error"
          >
            El nombre de la sucursal es obligatorio.
          </p>
        )}
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
          {phones.map((phone, index) => {
            const label = phone.label.trim();
            const number = phone.number.trim();
            // La fila vacía se descarta al enviar; si queda cargada a medias,
            // el servidor la rechaza y se muestra el motivo en vivo.
            const phoneError =
              !label && !number
                ? null
                : !label
                  ? 'La etiqueta del teléfono es obligatoria.'
                  : !number
                    ? 'El número del teléfono es obligatorio.'
                    : !isValidPhoneNumber(number)
                      ? 'El número no es válido. Usá solo dígitos, espacios y los símbolos + ( ) - .'
                      : null;
            const labelInvalid = !!phoneError && !label;
            const numberInvalid = !!phoneError && !!label;
            return (
              <div key={phone._id} className="space-y-1">
                <div className="flex items-center gap-2">
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
                    aria-invalid={labelInvalid}
                    aria-describedby={
                      labelInvalid
                        ? `branch-phone-${index}-error`
                        : undefined
                    }
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
                    aria-invalid={numberInvalid}
                    aria-describedby={
                      numberInvalid
                        ? `branch-phone-${index}-error`
                        : undefined
                    }
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
                {phoneError && (
                  <p
                    id={`branch-phone-${index}-error`}
                    role="alert"
                    className="text-xs text-destructive"
                    data-testid={`branch-phone-${index}-error`}
                  >
                    {phoneError}
                  </p>
                )}
              </div>
            );
          })}
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
          onChange={(e) => setLocationInput(e.target.value)}
          onBlur={() => setLocationTouched(true)}
          placeholder="Ej: -32.9468, -60.6393 o URL del mapa"
          data-testid="branch-location"
          aria-invalid={showLocationError}
          aria-describedby={
            showLocationError
              ? 'branch-location-error branch-location-help'
              : 'branch-location-help'
          }
        />
        {showLocationError && (
          <p
            id="branch-location-error"
            role="alert"
            className="text-sm text-destructive"
            data-testid="branch-location-error"
          >
            La ubicación no es válida. Usá coordenadas <code>lat,lng</code>,
            una URL de mapa o el código completo del iframe de
            &quot;Insertar mapa&quot;.
          </p>
        )}
        {locationDesc.status === 'link' && (
          <p
            className="text-sm text-muted-foreground"
            data-testid="branch-location-link-hint"
          >
            La ubicación es válida pero se mostrará como enlace
            &quot;Ver en mapa&quot; (sin mapa embebido) en el catálogo.
          </p>
        )}
        {locationDesc.status === 'embed' && locationDesc.embedUrl && (
          <BranchLocationPreview embedUrl={locationDesc.embedUrl} />
        )}
        <p id="branch-location-help" className="text-sm text-muted-foreground">
          Para que el mapa se vea embebido en el catálogo, lo mejor son las{' '}
          <strong>coordenadas</strong> <code>lat,lng</code> (en Google Maps:
          clic derecho sobre el punto → clic en las coordenadas para
          copiarlas): funcionan con cualquier proveedor. También sirve la
          URL completa de openstreetmap.org, el enlace de
          &quot;Compartir&quot; de Google Maps o el código completo de{' '}
          <strong>&quot;Insertar un mapa&quot;</strong> (Compartir → Insertar
          un mapa → copiar el HTML del <code>&lt;iframe&gt;</code>: se usa
          automáticamente la URL del <code>src</code>), siempre que
          correspondan al proveedor de mapas configurado. Los enlaces cortos
          (<code>maps.app.goo.gl/…</code>) y otras URLs se muestran como
          &quot;Ver en mapa&quot; sin mapa embebido.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Redes sociales (opcional)</Label>
        <p className="text-sm text-muted-foreground">
          URL completa (https://...) o nombre de usuario. En WhatsApp, el
          número con código de país. Se muestran en el catálogo público.
        </p>
        <div className="space-y-2">
          {socialLinks.map((link, index) => {
            const url = link.url.trim();
            // La fila siempre se envía (la red tiene valor por defecto), así
            // que el enlace vacío o inválido se marca en vivo.
            const socialError = !url
              ? `El enlace de ${getSocialNetworkLabel(link.network)} es obligatorio.`
              : !isValidSocialTarget(link.network, url)
                ? 'Ingresá una URL http(s) completa o un identificador válido (en WhatsApp, el número con código de país).'
                : null;
            return (
              <div key={link._id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Select
                    value={link.network}
                    name={`socialLinks[${index}][network]`}
                    onValueChange={(value) => {
                      if (value) updateSocialLink(link._id, 'network', value);
                    }}
                  >
                    <SelectTrigger
                      aria-label={`Red social ${index + 1}`}
                      data-testid={`branch-social-network-${index}`}
                      className="w-full sm:w-[160px]"
                    >
                      <SelectValue>
                        {(value) => getSocialNetworkLabel(value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_NETWORK_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    aria-invalid={!!socialError}
                    aria-describedby={
                      socialError
                        ? `branch-social-${index}-error`
                        : undefined
                    }
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
                {socialError && (
                  <p
                    id={`branch-social-${index}-error`}
                    role="alert"
                    className="text-xs text-destructive"
                    data-testid={`branch-social-${index}-error`}
                  >
                    {socialError}
                  </p>
                )}
              </div>
            );
          })}
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
          franja termina al día siguiente (ej. 20:00 a 02:00). Podés copiar
          las franjas de un día y pegarlas en otro con los botones
          &quot;Copiar&quot;/&quot;Pegar&quot;.
        </p>
        {hoursError && (
          <p
            role="alert"
            className="text-sm text-destructive"
            data-testid="branch-hours-error"
          >
            {hoursError}
          </p>
        )}
        {copied && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span data-testid="branch-hours-copied-hint">
              Copiado de {DAYS[copied.dayOfWeek]} ({copied.slots.length}{' '}
              franja{copied.slots.length === 1 ? '' : 's'}): usá
              &quot;Pegar&quot; en otro día.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid="branch-hours-copied-clear"
              onClick={() => setCopied(null)}
              className="size-5"
              aria-label="Descartar horarios copiados"
            >
              <X className="size-3" />
            </Button>
          </div>
        )}
        <div className="space-y-4">
          {DAYS.map((day, dayOfWeek) => {
            const slots = getSlotsForDay(dayOfWeek);
            const enabled = isDayEnabled(dayOfWeek);

            return (
              <div
                key={dayOfWeek}
                className="rounded-lg border border-white/8 p-3"
              >
                <div className="flex flex-wrap items-center gap-3">
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
                      data-testid={`branch-copy-day-${dayOfWeek}`}
                      onClick={() => handleCopyDay(dayOfWeek)}
                      className="h-auto px-2 py-1 text-xs"
                      aria-label={`Copiar horarios del ${day}`}
                    >
                      <Copy className="mr-1 size-3" />
                      Copiar
                    </Button>
                  )}
                  {copied && copied.dayOfWeek !== dayOfWeek && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-testid={`branch-paste-day-${dayOfWeek}`}
                      onClick={() => handlePasteDay(dayOfWeek)}
                      className="h-auto px-2 py-1 text-xs"
                      aria-label={`Pegar horarios en ${day}`}
                    >
                      <ClipboardPaste className="mr-1 size-3" />
                      Pegar
                    </Button>
                  )}
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
