import { executeInTransaction } from '@/application/transactionService';
import * as branchRepository from '@/repositories/branchRepository';
import { DomainError, NotFoundError, ValidationError } from '@/domain/errors';
import { validateNonEmptyString } from '@/lib/validation-helpers';
import { validateOpeningHours } from '@/lib/branch-helpers';
import { getRateLimitStore } from '@/lib/rate-limit-store';
import { deleteProductImage } from '@/lib/product-image-storage';
import { deleteChatAttachment } from '@/lib/chat-storage';
import { deleteVideoFileByUrl } from '@/lib/storage';
import { isValidLocationUrl, tryBuildLocationUrl } from '@/lib/maps';
import type { Branch, BranchOpeningHours } from '@/domain/types';

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

export async function listBranches(): Promise<Branch[]> {
  return branchRepository.findAllOrderedByCreatedAt() as Promise<Branch[]>;
}

export async function getBranchById(id: number): Promise<Branch | undefined> {
  return branchRepository.findById(id) as Promise<Branch | undefined>;
}

export async function createBranch(
  name: string,
  openingHours: BranchOpeningHours[] = [],
  address?: string | null,
  phone?: string | null,
  location?: string | null
) {
  const trimmed = validateNonEmptyString(name, 'El nombre de la sucursal');
  validateOpeningHours(openingHours);

  const existing = await branchRepository.findByName(trimmed);

  if (existing) {
    throw new ValidationError('Ya existe una sucursal con ese nombre.');
  }

  const normalizedLocation = normalizeLocation(location);

  const branch = await branchRepository.insert({
    name: trimmed,
    openingHours,
    address: address ?? null,
    phone: phone ?? null,
    location: normalizedLocation,
  });

  if (!branch) {
    throw new DomainError('No se pudo crear la sucursal.');
  }

  return branch as Branch;
}

export async function updateBranch(
  id: number,
  name: string,
  openingHours: BranchOpeningHours[] = [],
  address?: string | null,
  phone?: string | null,
  location?: string | null
) {
  const trimmed = validateNonEmptyString(name, 'El nombre de la sucursal');
  validateOpeningHours(openingHours);

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
  const existing = await branchRepository.findByNameCaseInsensitiveExcludingId(
    trimmed,
    id
  );

  if (existing) {
    throw new ValidationError('Ya existe otra sucursal con ese nombre.');
  }

  const normalizedLocation = normalizeLocation(location);

  const updated = await branchRepository.update(id, {
    name: trimmed,
    openingHours,
    address: address ?? null,
    phone: phone ?? null,
    location: normalizedLocation,
  });

  if (!updated) {
    throw new DomainError('No se pudo actualizar la sucursal.');
  }

  return updated as Branch;
}

export async function getBranchDeletionSummary(id: number) {
  const branch = await branchRepository.findById(id);

  if (!branch) {
    throw new NotFoundError('Sucursal', id);
  }

  const productIds = await branchRepository.findProductIdsByBranch(id);
  const counts = await branchRepository.countBranchDeletionImpact(
    id,
    productIds
  );

  return {
    branch: branch as Branch,
    counts: {
      ...counts,
      total:
        counts.products +
        counts.sales +
        counts.cashRegisters +
        counts.stockMovements +
        counts.users +
        counts.recipes +
        counts.orders +
        counts.videos,
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

  // Liberar archivos asociados fuera de la transacción para no bloquear el rollback.
  await Promise.allSettled(productImageKeys.map(deleteProductImage));
  await Promise.allSettled(chatAttachmentKeys.map(deleteChatAttachment));
  await Promise.allSettled(videoFileUrls.map(deleteVideoFileByUrl));

  // Limpiar intentos fallidos de login de los usuarios eliminados.
  const rateLimitStore = getRateLimitStore();
  await Promise.allSettled(usernames.map((username) => rateLimitStore.remove(username)));

  return branch as Branch;
}
