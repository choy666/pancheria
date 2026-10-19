import { ZodError } from 'zod';
import { executeInTransaction } from '@/application/transactionService';
import * as pantallaRepository from '@/repositories/pantallaRepository';
import * as productRepository from '@/repositories/productRepository';
import * as videoRepository from '@/repositories/videoRepository';
import * as catalogRepository from '@/repositories/catalogRepository';
import * as saleService from '@/application/services/saleService';
import { isPublicSellableProduct } from '@/lib/catalog';
import {
  getPantallaMaxProductos,
  getPantallaProductoMs,
  getPantallaQrMs,
  getPantallaSucursalMs,
  getPantallaVideoMaxMs,
} from '@/config/pantalla';
import { ValidationError } from '@/domain/errors';
import {
  pantallaPlaylistSchema,
  pantallaSettingsSchema,
} from '@/lib/zod-schemas';
import type {
  PantallaPlaylistItem,
  PantallaSettings,
} from '@/lib/pantalla-playlist';
import type {
  CriticalSupplyType,
  PantallaItemKind,
  ProductType,
} from '@/domain/types';

/**
 * Sin fila en `pantalla_settings` la sucursal conserva el comportamiento
 * histórico: modo automático con las duraciones de las variables
 * `NEXT_PUBLIC_PANTALLA_*` y las dos escenas fijas habilitadas.
 */
function defaultSettings(): PantallaSettings {
  return {
    playlistMode: 'auto',
    productoMs: getPantallaProductoMs(),
    sucursalMs: getPantallaSucursalMs(),
    qrMs: getPantallaQrMs(),
    videoMaxMs: getPantallaVideoMaxMs(),
    maxProductos: getPantallaMaxProductos(),
    showBranchScene: true,
    showQrScene: true,
  };
}

export async function getSettings(
  branchId: number
): Promise<PantallaSettings> {
  const row = await pantallaRepository.findSettings(branchId);
  if (!row) return defaultSettings();

  return {
    playlistMode: row.playlistMode,
    productoMs: row.productoMs,
    sucursalMs: row.sucursalMs,
    qrMs: row.qrMs,
    videoMaxMs: row.videoMaxMs,
    maxProductos: row.maxProductos,
    showBranchScene: row.showBranchScene,
    showQrScene: row.showQrScene,
  };
}

export async function updateSettings(branchId: number, input: unknown) {
  let data;
  try {
    data = pantallaSettingsSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        error.issues.map((issue) => issue.message).join('. ')
      );
    }
    throw error;
  }

  return pantallaRepository.upsertSettings(branchId, data);
}

/**
 * Ítems habilitados de la playlist explícita, ya ordenados y reducidos a
 * `{ kind, refId }` para el snapshot público. Los ítems deshabilitados se
 * conservan en la base (el panel los muestra como "ocultos") pero no viajan
 * a la TV.
 */
export async function listEnabledItems(
  branchId: number
): Promise<PantallaPlaylistItem[]> {
  const rows = await pantallaRepository.findItems(branchId, {
    enabledOnly: true,
  });

  return rows.flatMap((row) => {
    const refId = row.kind === 'product' ? row.productId : row.videoId;
    // El check `pantalla_items_ref_check` garantiza una referencia según el
    // kind; el guard cubre filas inconsistentes creadas por fuera del flujo.
    return refId === null ? [] : [{ kind: row.kind, refId }];
  });
}

/**
 * Estado mostrado junto a cada ítem en el editor de la playlist: avisa por
 * qué una entrada no llegaría a la pantalla pese a estar habilitada (sin
 * stock, referencia inactiva/eliminada, producto no vendible al público).
 */
export type PantallaItemStatus =
  | 'ok'
  | 'sin_stock'
  | 'inactivo'
  | 'eliminado'
  | 'no_vendible';

export type PantallaItemView = {
  id: number;
  kind: PantallaItemKind;
  refId: number;
  name: string;
  isEnabled: boolean;
  status: PantallaItemStatus;
};

export async function listPlaylist(
  branchId: number
): Promise<PantallaItemView[]> {
  const rows = await pantallaRepository.findItemsWithRefs(branchId);

  const productIds = rows.flatMap(({ item }) =>
    item.kind === 'product' && item.productId !== null ? [item.productId] : []
  );
  const availabilityById =
    productIds.length > 0
      ? await saleService.calculateAvailabilityForProductIds(
          branchId,
          productIds
        )
      : {};

  return rows.map(({ item, product, video }) => {
    if (item.kind === 'product') {
      const refId = item.productId ?? 0;
      const fallback = {
        id: item.id,
        kind: item.kind,
        refId,
        isEnabled: item.isEnabled,
      };
      if (!product || product.deletedAt) {
        return {
          ...fallback,
          name: product?.name ?? `Producto #${refId}`,
          status: 'eliminado' as const,
        };
      }
      let status: PantallaItemStatus = 'ok';
      if (!product.isActive) status = 'inactivo';
      else if (!isPublicSellableProduct(product)) status = 'no_vendible';
      else if ((availabilityById[product.id]?.availability ?? 0) <= 0)
        status = 'sin_stock';
      return { ...fallback, name: product.name, status };
    }

    const refId = item.videoId ?? 0;
    const fallback = {
      id: item.id,
      kind: item.kind,
      refId,
      isEnabled: item.isEnabled,
    };
    if (!video || video.deletedAt) {
      return {
        ...fallback,
        name: video?.title ?? `Video #${refId}`,
        status: 'eliminado' as const,
      };
    }
    return {
      ...fallback,
      name: video.title,
      status: video.isActive ? ('ok' as const) : ('inactivo' as const),
    };
  });
}

/**
 * Candidatos para agregar a la playlist: productos vendibles al público con
 * su disponibilidad actual (para avisar "sin stock" en el selector) y todos
 * los videos no eliminados con su flag de activo (los inactivos se pueden
 * sumar pero no se reproducen hasta activarlos).
 */
export type PantallaCandidateProduct = {
  id: number;
  name: string;
  type: ProductType;
  criticalSupplyType: CriticalSupplyType | null;
  availability: number;
};

export type PantallaCandidateVideo = {
  id: number;
  title: string;
  isActive: boolean;
};

export async function listCandidates(branchId: number): Promise<{
  products: PantallaCandidateProduct[];
  videos: PantallaCandidateVideo[];
}> {
  const [products, videos] = await Promise.all([
    catalogRepository.findPublicProducts(branchId),
    videoRepository.findAllNonDeleted(branchId),
  ]);

  const availabilityById =
    products.length > 0
      ? await saleService.calculateAvailabilityForProductIds(
          branchId,
          products.map((product) => product.id)
        )
      : {};

  return {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      criticalSupplyType: product.criticalSupplyType,
      availability: availabilityById[product.id]?.availability ?? 0,
    })),
    videos: videos.map((video) => ({
      id: video.id,
      title: video.title,
      isActive: video.isActive,
    })),
  };
}

/**
 * Reemplaza la playlist completa de la sucursal en una transacción
 * (mismo patrón que `saveRecipe`): `position` se reescribe como el índice
 * del array para mantener un orden denso 0..n-1.
 *
 * Validaciones: la referencia debe existir y pertenecer a la sucursal
 * (los `findByIds` filtran por `branchId`), no estar eliminada y, si es
 * producto, ser vendible al público — un insumo o un producto dado de baja
 * nunca podría renderizarse y quedaría como ítem muerto. Un producto
 * inactivo o un video inactivo sí se aceptan: el ítem queda en pausa hasta
 * que la referencia se reactive (la TV lo omite mientras tanto).
 */
export async function savePlaylist(branchId: number, input: unknown) {
  let items;
  try {
    items = pantallaPlaylistSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        error.issues.map((issue) => issue.message).join('. ')
      );
    }
    throw error;
  }

  const productIds = items
    .filter((item) => item.kind === 'product')
    .map((item) => item.refId);
  const videoIds = items
    .filter((item) => item.kind === 'video')
    .map((item) => item.refId);

  const [productsFound, videosFound] = await Promise.all([
    productRepository.findByIds(branchId, productIds, true),
    videoRepository.findByIds(branchId, videoIds, true),
  ]);

  const productById = new Map(productsFound.map((p) => [p.id, p]));
  const videoById = new Map(videosFound.map((v) => [v.id, v]));

  for (const item of items) {
    if (item.kind === 'product') {
      const product = productById.get(item.refId);
      if (!product) {
        throw new ValidationError(
          `El producto con ID ${item.refId} no existe en esta sucursal.`
        );
      }
      if (product.deletedAt) {
        throw new ValidationError(
          `El producto "${product.name}" está eliminado y no puede estar en la playlist.`
        );
      }
      if (!isPublicSellableProduct(product)) {
        throw new ValidationError(
          `El producto "${product.name}" no es vendible al público y no puede estar en la playlist.`
        );
      }
    } else {
      const video = videoById.get(item.refId);
      if (!video) {
        throw new ValidationError(
          `El video con ID ${item.refId} no existe en esta sucursal.`
        );
      }
      if (video.deletedAt) {
        throw new ValidationError(
          `El video "${video.title}" está eliminado y no puede estar en la playlist.`
        );
      }
    }
  }

  const rows = items.map((item, index) => ({
    branchId,
    kind: item.kind,
    productId: item.kind === 'product' ? item.refId : null,
    videoId: item.kind === 'video' ? item.refId : null,
    position: index,
    isEnabled: item.isEnabled,
  }));

  return executeInTransaction(async (tx) => {
    await pantallaRepository.deleteItemsByBranch(tx, branchId);
    return pantallaRepository.insertItems(tx, rows);
  });
}
