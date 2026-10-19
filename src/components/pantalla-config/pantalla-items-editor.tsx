'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type {
  PantallaCandidateProduct,
  PantallaCandidateVideo,
  PantallaItemStatus,
  PantallaItemView,
} from '@/application/services/pantallaService';
import type { PantallaPlaylistMode } from '@/domain/types';
import type { PantallaConfigState } from '@/app/(panel)/pantalla-config/actions';

interface PantallaPlaylistEditorProps {
  /** Modo vigente: la playlist personalizada solo aplica en `custom`. */
  mode: PantallaPlaylistMode;
  items: PantallaItemView[];
  candidates: {
    products: PantallaCandidateProduct[];
    videos: PantallaCandidateVideo[];
  };
  saveAction: (
    _prevState: PantallaConfigState,
    formData: FormData
  ) => Promise<PantallaConfigState>;
}

type EditorItem = {
  kind: 'product' | 'video';
  refId: number;
  name: string;
  enabled: boolean;
  /** `null` = se muestra sin problemas ('ok'); el resto lleva badge. */
  status: Exclude<PantallaItemStatus, 'ok'> | null;
};

const STATUS_LABELS: Record<Exclude<PantallaItemStatus, 'ok'>, string> = {
  sin_stock: 'Sin stock',
  inactivo: 'Inactivo',
  eliminado: 'Eliminado',
  no_vendible: 'No vendible',
};

function itemKey(item: Pick<EditorItem, 'kind' | 'refId'>): string {
  return `${item.kind}:${item.refId}`;
}

function fromServer(items: PantallaItemView[]): EditorItem[] {
  return items.map((item) => ({
    kind: item.kind,
    refId: item.refId,
    name: item.name,
    enabled: item.isEnabled,
    status: item.status === 'ok' ? null : item.status,
  }));
}

/**
 * Editor de la playlist explícita de la pantalla (modo `custom`): agrega
 * productos/videos candidatos, los reordena con flechas, los habilita u
 * oculta sin sacarlos, y persiste todo el arreglo de una vez (el servidor
 * reescribe `position` como el índice). Mientras el modo sea `auto` la
 * lista se edita igual pero la TV la ignora.
 */
export function PantallaPlaylistEditor({
  mode,
  items,
  candidates,
  saveAction,
}: PantallaPlaylistEditorProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [list, setList] = useState<EditorItem[]>(() => fromServer(items));
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState('');
  const [state, setState] = useState<PantallaConfigState>(null);
  const [isPending, startTransition] = useTransition();

  // Resincroniza con los datos del servidor cuando la página se revalida
  // (post-guardado vía router.refresh() o si otro admin tocó la playlist),
  // sin pisar ediciones locales aún no guardadas. Ajuste de estado durante
  // el render (patrón oficial de React) en vez de efecto.
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    if (!dirty) {
      setList(fromServer(items));
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(async () => {
      const result = await saveAction(null, formData);
      setState(result);
      if (result?.success) {
        setDirty(false);
        // Triggea la re-renderización server-side: la prop `items` llega
        // fresca y el ajuste de arriba adopta la versión persistida.
        router.refresh();
      }
    });
  }

  const inPlaylist = useMemo(
    () => new Set(list.map(itemKey)),
    [list]
  );

  const availableProducts = candidates.products.filter(
    (product) => !inPlaylist.has(`product:${product.id}`)
  );
  const availableVideos = candidates.videos.filter(
    (video) => !inPlaylist.has(`video:${video.id}`)
  );
  const hasCandidates =
    availableProducts.length > 0 || availableVideos.length > 0;

  function addSelected() {
    if (!selected) return;
    const [kind, id] = selected.split(':');
    const refId = Number(id);

    let name = '';
    let status: EditorItem['status'] = null;
    if (kind === 'product') {
      const product = availableProducts.find((p) => p.id === refId);
      if (!product) return;
      name = product.name;
      if (product.availability <= 0) status = 'sin_stock';
    } else if (kind === 'video') {
      const video = availableVideos.find((v) => v.id === refId);
      if (!video) return;
      name = video.title;
      if (!video.isActive) status = 'inactivo';
    } else {
      return;
    }

    setList((prev) => [
      ...prev,
      { kind, refId, name, enabled: true, status },
    ]);
    setSelected('');
    setDirty(true);
  }

  function move(index: number, delta: -1 | 1) {
    setList((prev) => {
      const target = index + delta;
      if (index < 0 || index >= prev.length || target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }

  function toggleEnabled(index: number) {
    setList((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, enabled: !item.enabled } : item
      )
    );
    setDirty(true);
  }

  function remove(index: number) {
    setList((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }

  const payload = JSON.stringify(
    list.map((item) => ({
      kind: item.kind,
      refId: item.refId,
      isEnabled: item.enabled,
    }))
  );

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      data-testid="pantalla-playlist-form"
    >
      <input type="hidden" name="items" value={payload} />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            Playlist personalizada
            {mode === 'auto' && (
              <Badge variant="secondary" data-testid="pantalla-playlist-inactive-hint">
                Inactiva: la pantalla está en modo automático
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Ítems que rota la TV en el orden de la lista. Un producto sin
            stock se omite solo; un item oculto queda en la lista pero no se
            muestra. {mode === 'auto'
              ? 'Para que la pantalla la use, cambiá el modo a Personalizada.'
              : ''}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="min-h-11 flex-1 rounded-lg border border-input bg-input/50 px-3 text-sm"
              data-testid="pantalla-candidate-select"
              aria-label="Agregar producto o video a la playlist"
            >
              <option value="">Agregar ítem…</option>
              {availableProducts.length > 0 && (
                <optgroup label="Productos">
                  {availableProducts.map((product) => (
                    <option
                      key={product.id}
                      value={`product:${product.id}`}
                    >
                      {product.name}
                      {product.availability <= 0 ? ' — sin stock' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {availableVideos.length > 0 && (
                <optgroup label="Videos">
                  {availableVideos.map((video) => (
                    <option key={video.id} value={`video:${video.id}`}>
                      {video.title}
                      {video.isActive ? '' : ' — inactivo'}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={addSelected}
              disabled={!selected}
              data-testid="pantalla-add-item"
              className="sm:w-auto"
            >
              Agregar
            </Button>
          </div>

          {!hasCandidates && list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay productos vendibles ni videos para agregar.
            </p>
          )}

          <ul className="divide-y divide-white/8 rounded-xl border border-white/8">
            {list.map((item, index) => (
              <li
                key={itemKey(item)}
                data-testid="pantalla-item-row"
                className="flex flex-wrap items-center gap-2 p-3 sm:gap-3"
              >
                <span className="w-7 text-center font-mono text-sm text-muted-foreground">
                  {index + 1}
                </span>
                <Badge variant={item.kind === 'video' ? 'secondary' : 'default'}>
                  {item.kind === 'video' ? 'Video' : 'Producto'}
                </Badge>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate font-medium',
                    !item.enabled && 'text-muted-foreground line-through'
                  )}
                  data-testid="pantalla-item-name"
                >
                  {item.name}
                </span>
                {item.status && (
                  <Badge
                    variant={
                      item.status === 'sin_stock' || item.status === 'inactivo'
                        ? 'secondary'
                        : 'destructive'
                    }
                    data-testid="pantalla-item-status"
                  >
                    {STATUS_LABELS[item.status]}
                  </Badge>
                )}
                <label
                  className="flex cursor-pointer items-center gap-2 text-sm"
                  title="Mostrar u ocultar en la pantalla sin quitarlo de la playlist"
                >
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleEnabled(index)}
                    className="h-4 w-4 accent-primary"
                    data-testid="pantalla-item-toggle"
                  />
                  Visible
                </label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Subir ${item.name}`}
                    data-testid="pantalla-item-up"
                  >
                    <ArrowUp aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, 1)}
                    disabled={index === list.length - 1}
                    aria-label={`Bajar ${item.name}`}
                    data-testid="pantalla-item-down"
                  >
                    <ArrowDown aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(index)}
                    aria-label={`Quitar ${item.name}`}
                    data-testid="pantalla-item-remove"
                  >
                    <X aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
            {list.length === 0 && (
              <li className="p-4 text-center text-sm text-muted-foreground">
                Playlist vacía: en modo personalizado la pantalla solo rota
                las escenas fijas habilitadas.
              </li>
            )}
          </ul>

          {state?.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {state?.success && (
            <p
              className="text-sm text-green-600"
              role="status"
              data-testid="pantalla-playlist-success"
            >
              {state.success}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex-col items-start gap-2 sm:flex-row sm:items-center">
          <Button
            type="submit"
            disabled={isPending || !dirty}
            data-testid="pantalla-save-playlist"
            className="w-full sm:w-auto"
          >
            {isPending ? 'Guardando...' : 'Guardar playlist'}
          </Button>
          {dirty && (
            <span
              className="text-sm text-muted-foreground"
              data-testid="pantalla-playlist-dirty"
            >
              Cambios sin guardar.
            </span>
          )}
        </CardFooter>
      </Card>
    </form>
  );
}
