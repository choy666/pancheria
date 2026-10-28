import { groupPublicProductsByType } from '@/lib/catalog';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type {
  Branch,
  BrandSettings,
  PantallaItemKind,
  PantallaPlaylistMode,
} from '@/domain/types';

/**
 * Recorte público de un video activo para la playlist de `/pantalla`.
 * Solo viaja lo que la TV necesita para reproducir.
 */
export type PantallaVideo = {
  id: number;
  title: string;
  fileUrl: string;
  mimeType: string;
};

/**
 * Configuración efectiva de la pantalla publicitaria de una sucursal: la
 * fila de `pantalla_settings` o, si aún no existe, los defaults de las
 * variables `NEXT_PUBLIC_PANTALLA_*` (ver `pantallaService.getSettings`).
 * Las duraciones están en milisegundos.
 */
export type PantallaSettings = {
  playlistMode: PantallaPlaylistMode;
  productoMs: number;
  sucursalMs: number;
  qrMs: number;
  /** Tope del watchdog de una escena de video sin `ended`/`error`. */
  videoMaxMs: number;
  /** Solo modo `auto`: tope de productos del catálogo por ciclo. */
  maxProductos: number;
  showBranchScene: boolean;
  showQrScene: boolean;
};

/**
 * Referencia de la playlist explícita (modo `custom`): `refId` apunta a
 * `products.id` o `videos.id` según `kind`. Viaja en el snapshot ya filtrada
 * a ítems habilitados y ordenada por `position`.
 */
export type PantallaPlaylistItem = {
  kind: PantallaItemKind;
  refId: number;
};

/**
 * Snapshot que consume la pantalla publicitaria: lo entrega el SSR inicial
 * y lo refresca `GET /api/public/pantalla` en cada poll.
 */
export type PantallaSnapshot = {
  branch: Branch;
  brand: BrandSettings;
  isOpen: boolean;
  currentOpening: string;
  nextOpening: string;
  message: string;
  products: PublicCatalogProduct[];
  videos: PantallaVideo[];
  settings: PantallaSettings;
  items: PantallaPlaylistItem[];
};

export type PantallaScene =
  | { kind: 'video'; key: string; video: PantallaVideo }
  | { kind: 'product'; key: string; product: PublicCatalogProduct }
  | { kind: 'branch'; key: 'branch' }
  | { kind: 'qr'; key: 'qr' };

function productScene(product: PublicCatalogProduct): PantallaScene {
  return { kind: 'product', key: `product:${product.id}`, product };
}

function videoScene(video: PantallaVideo): PantallaScene {
  return { kind: 'video', key: `video:${video.id}`, video };
}

/**
 * Modo automático (el histórico): videos y productos intercalados
 * (V, P, V, P…). Productos con `availability <= 0` se ocultan (los
 * `service` reportan `MAX_SAFE_INTEGER`, así que siempre entran). El orden
 * respeta el agrupamiento público del catálogo (`compound` primero =
 * promos/combos) y se recorta a `maxProductos` por ciclo para acotar la
 * duración del loop.
 */
function buildAutoScenes(
  videos: PantallaVideo[],
  products: PublicCatalogProduct[],
  maxProductos: number
): PantallaScene[] {
  const productScenes: PantallaScene[] = groupPublicProductsByType(
    products.filter((product) => product.availability > 0)
  )
    .flatMap((group) => group.items)
    .slice(0, maxProductos)
    .map(productScene);

  const videoScenes: PantallaScene[] = videos.map(videoScene);

  const scenes: PantallaScene[] = [];
  const slots = Math.max(videoScenes.length, productScenes.length);
  for (let i = 0; i < slots; i += 1) {
    if (i < videoScenes.length) scenes.push(videoScenes[i]);
    if (i < productScenes.length) scenes.push(productScenes[i]);
  }
  return scenes;
}

/**
 * Modo personalizado: recorre `items` en el orden elegido en el panel y
 * emite la escena solo si la referencia sigue siendo mostrable — el
 * producto existe en el catálogo público con `availability > 0` (igual que
 * en modo auto: la pantalla no anuncia lo que no se puede vender) y el
 * video sigue activo (los inactivos ni siquiera viajan en el snapshot).
 */
function buildCustomScenes(
  videos: PantallaVideo[],
  products: PublicCatalogProduct[],
  items: PantallaPlaylistItem[]
): PantallaScene[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const scenes: PantallaScene[] = [];

  for (const item of items) {
    if (item.kind === 'product') {
      const product = productById.get(item.refId);
      if (product && product.availability > 0) {
        scenes.push(productScene(product));
      }
    } else {
      const video = videoById.get(item.refId);
      if (video) scenes.push(videoScene(video));
    }
  }
  return scenes;
}

/**
 * Construye la lista de escenas de un ciclo de la pantalla y cierra con las
 * escenas fijas habilitadas (horarios de la sucursal y QR hacia `/pedido`).
 *
 * La playlist nunca queda vacía: si todo quedó deshabilitado o sin
 * referencias válidas, se fuerza la escena de sucursal — una TV con un solo
 * mensaje útil es mejor que una pantalla negra.
 */
export function buildPantallaPlaylist(
  snapshot: PantallaSnapshot
): PantallaScene[] {
  const { products, videos, items, settings } = snapshot;

  const scenes =
    settings.playlistMode === 'custom'
      ? buildCustomScenes(videos, products, items)
      : buildAutoScenes(videos, products, settings.maxProductos);

  if (settings.showBranchScene) {
    scenes.push({ kind: 'branch', key: 'branch' });
  }
  if (settings.showQrScene) {
    scenes.push({ kind: 'qr', key: 'qr' });
  }

  if (scenes.length === 0) {
    scenes.push({ kind: 'branch', key: 'branch' });
  }

  return scenes;
}
