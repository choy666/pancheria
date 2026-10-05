import { executeInTransaction } from '@/application/transactionService';
import * as branchRepository from '@/repositories/branchRepository';
import { DomainError, NotFoundError, ValidationError } from '@/domain/errors';
import { validateNonEmptyString } from '@/lib/validation-helpers';
import {
  normalizeBranchPhones,
  normalizeSocialLinks,
  validateOpeningHours,
} from '@/lib/branch-helpers';
import { getRateLimitStore } from '@/lib/rate-limit-store';
import { logger } from '@/lib/logger';
import { deleteProductImage } from '@/lib/product-image-storage';
import { deleteChatAttachment } from '@/lib/chat-storage';
import { deleteVideoFileByUrl } from '@/lib/storage';
import { isValidLocationUrl, tryBuildLocationUrl } from '@/lib/maps';
import { getCachedBranchById } from '@/lib/server-cache';
import { getDefaultBranchName } from '@/config/branch';
import type { Branch, BranchOpeningHours } from '@/domain/types';

/**
 * Datos de entrada para crear o actualizar una sucursal. `phones` y
 * `socialLinks` se aceptan como `unknown` porque pueden venir parseados de un
 * FormData o de una variable de entorno JSON; se validan/normalizan acá.
 */
export interface BranchInput {
  name: string;
  openingHours?: BranchOpeningHours[];
  address?: string | null;
  phones?: unknown;
  socialLinks?: unknown;
  location?: string | null;
}

function normalizeLocation(
  location: string | null | undefined
): string | null {
  if (location === null || location === undefined) return null;
  const trimmed = location.trim();
  if (!trimmed) return null;

  const normalized = tryBuildLocationUrl(trimmed);
  if (!normalized || !isValidLocationUrl(normalized)) {
    throw new ValidationError(
      'La ubicación no es una URL ni coordenadas válidas.'
    );
  }
  return normalized;
}

export async function listBranches(
  options: { limit?: number } = {}
): Promise<Branch[]> {
  return branchRepository.findAllOrderedByCreatedAt(options) as Promise<
    Branch[]
  >;
}

// Cacheado en la capa de servidor (Data Cache): los datos de sucursal son
// pseudo-estáticos y esta lectura está en los paths calientes (chat,
// catálogo, estado público). Las mutaciones de sucursal invalidan el tag
// `branches` desde las server actions.
export async function getBranchById(id: number): Promise<Branch | undefined> {
  return getCachedBranchById(id);
}

export async function createBranch(input: BranchInput) {
  const trimmed = validateNonEmptyString(input.name, 'El nombre de la sucursal');
  const openingHours = input.openingHours ?? [];
  validateOpeningHours(openingHours);
  const phones = normalizeBranchPhones(input.phones);
  const socialLinks = normalizeSocialLinks(input.socialLinks);

  // Búsqueda case-insensitive, igual que en `updateBranch`: el índice unique
  // de `branches.name` es case-sensitive y permitía duplicados tipo
  // "Centro"/"CENTRO".
  const existing = await branchRepository.findByNameCaseInsensitive(trimmed);

  if (existing) {
    throw new ValidationError('Ya existe una sucursal con ese nombre.');
  }

  const normalizedLocation = normalizeLocation(input.location);

  const branch = await branchRepository.insert({
    name: trimmed,
    openingHours,
    address: input.address ?? null,
    phones,
    socialLinks,
    location: normalizedLocation,
  });

  if (!branch) {
    throw new DomainError('No se pudo crear la sucursal.');
  }

  return branch as Branch;
}

export async function updateBranch(id: number, input: BranchInput) {
  const trimmed = validateNonEmptyString(input.name, 'El nombre de la sucursal');
  const openingHours = input.openingHours ?? [];
  validateOpeningHours(openingHours);
  const phones = normalizeBranchPhones(input.phones);
  const socialLinks = normalizeSocialLinks(input.socialLinks);

  const branch = await branchRepository.findById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  // Búsqueda case-insensitive para evitar nombres duplicados que difieran
  // solo en mayúsculas/minúsculas. Esto supera la validación del índice
  // unique nativo de PostgreSQL, que es case-sensitive. Si se desea
  // reforzar la unicidad a nivel de base de datos, es necesario migrar la
  // columna `name` a un tipo case-insensitive (como `citext`) o agregar un
  // índice unique sobre una expresión en minúsculas (`lower(name)`).
  const existing = await branchRepository.findByNameCaseInsensitive(
    trimmed,
    id
  );

  if (existing) {
    throw new ValidationError('Ya existe otra sucursal con ese nombre.');
  }

  const normalizedLocation = normalizeLocation(input.location);

  const updated = await branchRepository.update(id, {
    name: trimmed,
    openingHours,
    address: input.address ?? null,
    phones,
    socialLinks,
    location: normalizedLocation,
  });

  if (!updated) {
    throw new DomainError('No se pudo actualizar la sucursal.');
  }

  return updated as Branch;
}

/**
 * Resumen de impacto para el diálogo de eliminación. Además de los conteos
 * por tabla incluye `flags` con los escenarios de mayor daño (sucursal por
 * defecto del catálogo, cuenta del propio admin, caja abierta, pedidos en
 * curso, última sucursal) para que el aviso sea específico, no solo un
 * conteo genérico.
 *
 * `currentUserBranchId` es el `branchId` asignado al usuario autenticado
 * (ya revalidado por `requireAdmin` en la action), no la sucursal activa de
 * la cookie: es el dato que determina el riesgo de lockout.
 */
export async function getBranchDeletionSummary(
  id: number,
  currentUserBranchId?: number
) {
  const branch = await branchRepository.findById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  const [productIds, cascaded, branchCount] = await Promise.all([
    branchRepository.findProductIdsByBranch(id),
    branchRepository.countDeletionCascadeChildren(id),
    branchRepository.countBranches(),
  ]);
  const { openCashRegisters, activeOrders, ...topCounts } =
    await branchRepository.countBranchDeletionImpact(id, productIds);

  const cascadedTotal =
    cascaded.saleItems +
    cascaded.salePayments +
    cascaded.saleItemRecipes +
    cascaded.orderItems +
    cascaded.orderItemRecipes +
    cascaded.orderMessages +
    cascaded.orderStockReservations;

  const topTotal =
    topCounts.products +
    topCounts.sales +
    topCounts.cashRegisters +
    topCounts.stockMovements +
    topCounts.users +
    topCounts.recipes +
    topCounts.orders +
    topCounts.videos;

  // Mismo criterio que `getDefaultBranchId` (`findByName`): igualdad exacta
  // case-sensitive, no la unicidad case-insensitive de create/update.
  const defaultBranchName = getDefaultBranchName();

  return {
    // El diálogo solo muestra el nombre (además del prop que ya recibe):
    // serializar el Branch completo era over-fetch (H-m13).
    branch: { id: branch.id, name: branch.name },
    counts: {
      ...topCounts,
      cascaded: cascadedTotal,
      total: topTotal + cascadedTotal,
    },
    flags: {
      isDefaultBranch:
        !!defaultBranchName && branch.name === defaultBranchName,
      isSelfBranch: currentUserBranchId === branch.id,
      isLastBranch: branchCount === 1,
      hasOpenCashRegister: openCashRegisters > 0,
      activeOrders,
    },
  };
}

/**
 * Activa o desactiva una sucursal. La desactivación solo apaga la
 * superficie pública (selector y resolución de /pedido, catálogo,
 * disponibilidad, estado y creación de pedidos): el panel, las ventas
 * internas, la caja y el historial siguen operando, y los pedidos
 * existentes conservan seguimiento/cancelación/chat. Es la alternativa
 * reversible a `deleteBranch`.
 */
export async function setBranchActive(id: number, isActive: boolean) {
  const branch = await branchRepository.findById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  const updated = await branchRepository.update(id, { isActive });

  if (!updated) {
    throw new DomainError('No se pudo actualizar la sucursal.');
  }

  return updated as Branch;
}

/**
 * Resumen para el diálogo de desactivación: a diferencia del de borrado
 * (que informa qué se pierde), acá nada se pierde — solo se advierten los
 * efectos inmediatos de apagar el canal público (caja abierta, pedidos en
 * curso, sucursal por defecto, última activa).
 */
export async function getBranchDeactivationSummary(
  id: number,
  currentUserBranchId?: number
) {
  const branch = await branchRepository.findById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  const [productIds, activeBranchCount] = await Promise.all([
    branchRepository.findProductIdsByBranch(id),
    branchRepository.countActiveBranches(),
  ]);
  const { openCashRegisters, activeOrders } =
    await branchRepository.countBranchDeletionImpact(id, productIds);

  const defaultBranchName = getDefaultBranchName();

  return {
    branch: { id: branch.id, name: branch.name, isActive: branch.isActive },
    openCashRegisters,
    activeOrders,
    flags: {
      isDefaultBranch:
        !!defaultBranchName && branch.name === defaultBranchName,
      isSelfBranch: currentUserBranchId === branch.id,
      isLastActiveBranch: branch.isActive && activeBranchCount === 1,
    },
  };
}

export async function deleteBranch(id: number) {
  const branch = await branchRepository.findById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  const [usernames, productRows, orderIds] = await Promise.all([
    branchRepository.findUsernamesByBranch(id),
    branchRepository.findProductImageKeysByBranch(id),
    branchRepository.findOrderIdsByBranch(id),
  ]);

  const productIds = productRows.map((row) => row.id);
  const productImageKeys = productRows
    .map((row) => row.imageKey)
    .filter((key): key is string => Boolean(key));
  const chatAttachmentKeys =
    await branchRepository.findAttachmentKeysByOrderIds(orderIds);
  const videoFileUrls = await branchRepository.findVideoFileUrlsByBranch(id);

  await executeInTransaction(async (tx) => {
    await branchRepository.deleteCascade(tx, id, productIds);
  });

  const cleanupResults = await Promise.all([
    Promise.allSettled(productImageKeys.map(deleteProductImage)),
    Promise.allSettled(chatAttachmentKeys.map(deleteChatAttachment)),
    Promise.allSettled(videoFileUrls.map(deleteVideoFileByUrl)),
  ]);
  const [failedProductImages, failedChatAttachments, failedVideos] =
    cleanupResults.map(
      (results) => results.filter((result) => result.status === 'rejected').length
    );

  if (failedProductImages + failedChatAttachments + failedVideos > 0) {
    logger.warn('No se pudieron eliminar todos los archivos de una sucursal', {
      branchId: id,
      failedProductImages,
      failedChatAttachments,
      failedVideos,
      retryJob: 'cron/chat-attachments-cleanup',
    });
  }

  const rateLimitStore = getRateLimitStore();
  const rateLimitResults = await Promise.allSettled(
    usernames.map((username) => rateLimitStore.remove(username))
  );
  const failedRateLimitRemovals = rateLimitResults.filter(
    (result) => result.status === 'rejected'
  ).length;

  if (failedRateLimitRemovals > 0) {
    logger.warn('No se pudieron limpiar todos los intentos de login de la sucursal', {
      branchId: id,
      failedRateLimitRemovals,
      retryJob: 'cron/rate-limit-cleanup',
    });
  }

  return branch as Branch;
}
