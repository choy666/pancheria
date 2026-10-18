import { groupPublicProductsByType } from '@/lib/catalog';
import type { PublicCatalogProduct } from '@/application/services/catalogService';
import type { Branch } from '@/domain/types';

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
 * Snapshot que consume la pantalla publicitaria: lo entrega el SSR inicial
 * y lo refresca `GET /api/public/pantalla` en cada poll.
 */
export type PantallaSnapshot = {
  branch: Branch;
  isOpen: boolean;
  currentOpening: string;
  nextOpening: string;
  message: string;
  products: PublicCatalogProduct[];
  videos: PantallaVideo[];
};

export type PantallaScene =
  | { kind: 'video'; key: string; video: PantallaVideo }
  | { kind: 'product'; key: string; product: PublicCatalogProduct }
  | { kind: 'branch'; key: 'branch' }
  | { kind: 'qr'; key: 'qr' };

/**
 * Construye la lista de escenas de un ciclo de la pantalla:
 * videos y productos intercalados (V, P, V, P…), y al final la escena de
 * horarios de la sucursal seguida de la del QR hacia `/pedido`.
 *
 * Productos con `availability <= 0` se ocultan (los `service` reportan
 * `MAX_SAFE_INTEGER`, así que siempre entran). El orden respeta el
 * agrupamiento público del catálogo (`compound` primero = promos/combos)
 * y se recorta a `maxProductos` por ciclo para acotar la duración del loop.
 *
 * Sin videos ni productos queda `[branch, qr]`: la pantalla sigue siendo
 * útil mostrando horarios y el QR de pedidos.
 */
export function buildPantallaPlaylist(
  videos: PantallaVideo[],
  products: PublicCatalogProduct[],
  options: { maxProductos: number }
): PantallaScene[] {
  const productScenes: PantallaScene[] = groupPublicProductsByType(
    products.filter((product) => product.availability > 0)
  )
    .flatMap((group) => group.items)
    .slice(0, options.maxProductos)
    .map((product) => ({
      kind: 'product' as const,
      key: `product:${product.id}`,
      product,
    }));

  const videoScenes: PantallaScene[] = videos.map((video) => ({
    kind: 'video' as const,
    key: `video:${video.id}`,
    video,
  }));

  const scenes: PantallaScene[] = [];
  const slots = Math.max(videoScenes.length, productScenes.length);
  for (let i = 0; i < slots; i += 1) {
    if (i < videoScenes.length) scenes.push(videoScenes[i]);
    if (i < productScenes.length) scenes.push(productScenes[i]);
  }

  scenes.push({ kind: 'branch', key: 'branch' }, { kind: 'qr', key: 'qr' });
  return scenes;
}
