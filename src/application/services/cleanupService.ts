import path from 'path';
import * as orderMessageRepository from '@/repositories/orderMessageRepository';
import * as productRepository from '@/repositories/productRepository';
import * as videoRepository from '@/repositories/videoRepository';
import {
  getChatLocalStorageBasePath,
  getLocalStorageBasePath,
  getProductImageLocalStorageBasePath,
} from '@/config/storage';
import { getStorageProvider } from '@/config/videos';
import { deleteChatAttachment } from '@/lib/chat-storage';
import { deleteProductImage } from '@/lib/product-image-storage';
import { deleteStorageFile, extractVideoKeyFromUrl } from '@/lib/storage';
import {
  listLocalKeys,
  listRemoteKeys,
  deleteOrphanedKeys,
  type OrphanCleanupResult,
} from '@/lib/orphaned-files';

const CLEANUP_BATCH_SIZE = 500;

/**
 * Recolecta todas las claves vivas de un listado paginado del repositorio.
 */
async function collectKeys(
  fetchBatch: (options: { limit: number; offset: number }) => Promise<string[]>
): Promise<Set<string>> {
  const keys = new Set<string>();

  for (let offset = 0; ; offset += CLEANUP_BATCH_SIZE) {
    const batch = await fetchBatch({
      limit: CLEANUP_BATCH_SIZE,
      offset,
    });

    for (const key of batch) {
      keys.add(key);
    }

    if (batch.length < CLEANUP_BATCH_SIZE) break;
  }

  return keys;
}

/** Adjunta el prefijo remoto a las claves relativas del listado local. */
function withPrefix(keys: string[], prefix: string): string[] {
  return keys.map((key) => `${prefix}${key}`);
}

/**
 * Aduntos de chat: claves `chat/{orderId}/{archivo}` contra
 * `order_messages.attachment_key`.
 */
export async function cleanupOrphanedChatAttachments(): Promise<OrphanCleanupResult> {
  const provider = getStorageProvider();
  const liveKeys = await collectKeys((options) =>
    orderMessageRepository.findAllAttachmentKeys(options)
  );

  const candidateKeys =
    provider === 'local'
      ? withPrefix(
          await listLocalKeys(
            path.join(getChatLocalStorageBasePath(), 'chat'),
            true
          ),
          'chat/'
        )
      : await listRemoteKeys(provider, 'chat/');

  return deleteOrphanedKeys(candidateKeys, liveKeys, deleteChatAttachment);
}

/**
 * Imágenes de producto: claves `product-images/{productId}/{archivo}` contra
 * `products.image_key`.
 */
export async function cleanupOrphanedProductImages(): Promise<OrphanCleanupResult> {
  const provider = getStorageProvider();
  const liveKeys = await collectKeys((options) =>
    productRepository.findAllImageKeys(options)
  );

  const candidateKeys =
    provider === 'local'
      ? withPrefix(
          await listLocalKeys(
            path.join(getProductImageLocalStorageBasePath(), 'product-images'),
            true
          ),
          'product-images/'
        )
      : await listRemoteKeys(provider, 'product-images/');

  return deleteOrphanedKeys(candidateKeys, liveKeys, deleteProductImage);
}

/**
 * Videos: locales son claves planas en el directorio base; remotos van bajo
 * `videos/`. Las claves vivas salen de `videos.file_url`.
 */
export async function cleanupOrphanedVideos(): Promise<OrphanCleanupResult> {
  const provider = getStorageProvider();
  const fileUrls = await collectKeys((options) =>
    videoRepository.findAllFileUrls(options)
  );
  const liveKeys = new Set<string>();
  for (const fileUrl of fileUrls) {
    const key = extractVideoKeyFromUrl(fileUrl);
    if (key) liveKeys.add(key);
  }

  const candidateKeys =
    provider === 'local'
      ? await listLocalKeys(getLocalStorageBasePath(), false)
      : await listRemoteKeys(provider, 'videos/');

  return deleteOrphanedKeys(candidateKeys, liveKeys, deleteStorageFile);
}

/**
 * Borra mensajes de pedidos en estado terminal (`finished`/`cancelled`)
 * creados hace más de `retentionDays` días. Libera los adjuntos de los
 * mensajes borrados (si el borrado del archivo falla, queda cubierto por
 * `cleanupOrphanedChatAttachments`).
 */
export async function cleanupExpiredOrderMessages(
  retentionDays: number
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let deleted = 0;

  for (;;) {
    const batch = await orderMessageRepository.findExpiredForTerminalOrders(
      cutoff,
      CLEANUP_BATCH_SIZE
    );
    if (batch.length === 0) break;

    deleted += await orderMessageRepository.deleteByIds(
      batch.map((row) => row.id)
    );

    for (const row of batch) {
      if (row.attachmentKey) {
        await deleteChatAttachment(row.attachmentKey);
      }
    }

    if (batch.length < CLEANUP_BATCH_SIZE) break;
  }

  return deleted;
}
