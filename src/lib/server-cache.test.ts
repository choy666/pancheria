/**
 * @jest-environment node
 *
 * `server-cache.ts` captura `DATA_CACHE_REVALIDATE_S` a nivel módulo, así que
 * las pruebas usan `jest.resetModules()` + `await import` con la variable ya
 * definida. `next/cache` está mapeado al stub passthrough de
 * `tests/mocks/next-cache.ts` (ver `moduleNameMapper` en `jest.config.ts`):
 * la capa "habilitada" se ejerce a través de ese passthrough, por lo que el
 * comportamiento observable es la revivificación de fechas y la invalidación
 * por tag.
 */
import type { ProductRow } from '@/domain/types';
import type * as branchRepositoryModule from '@/repositories/branchRepository';
import type * as catalogRepositoryModule from '@/repositories/catalogRepository';

/** Fila de sucursal tal como la devuelve el repositorio (post-DB). */
type BranchRow = NonNullable<
  Awaited<ReturnType<typeof branchRepositoryModule.findById>>
>;

jest.mock('@/repositories/branchRepository');
jest.mock('@/repositories/catalogRepository');

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.resetModules();
});

/** Recarga el módulo bajo prueba y devuelve los mocks frescos del registry. */
async function cargarModulo() {
  const branchRepository = (await import(
    '@/repositories/branchRepository'
  )) as jest.Mocked<typeof branchRepositoryModule>;
  const catalogRepository = (await import(
    '@/repositories/catalogRepository'
  )) as jest.Mocked<typeof catalogRepositoryModule>;
  const nextCache = await import('next/cache');
  const serverCache = await import('./server-cache');

  return {
    serverCache,
    branchRepository,
    catalogRepository,
    revalidateTag: nextCache.revalidateTag as jest.Mock,
  };
}

function branchConFechasEnTexto(): BranchRow {
  return {
    id: 1,
    name: 'Centro',
    createdAt: '2026-01-01T00:00:00.000Z',
  } as unknown as BranchRow;
}

function productoConFechasEnTexto(): ProductRow {
  return {
    id: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    deletedAt: null,
  } as unknown as ProductRow;
}

describe('server-cache', () => {
  describe('con la capa habilitada (default)', () => {
    test('revive las fechas de la sucursal devuelta por el repositorio', async () => {
      const { serverCache, branchRepository } = await cargarModulo();
      branchRepository.findById.mockResolvedValue(branchConFechasEnTexto());

      const branch = await serverCache.getCachedBranchById(1);

      expect(branch?.createdAt).toBeInstanceOf(Date);
    });

    test('getCachedBranchIdByName devuelve el id o null', async () => {
      const { serverCache, branchRepository } = await cargarModulo();
      branchRepository.findByName.mockResolvedValue({
        id: 3,
      } as unknown as Awaited<ReturnType<typeof branchRepository.findByName>>);
      branchRepository.findByName.mockResolvedValueOnce(undefined);

      expect(await serverCache.getCachedBranchIdByName('Inexistente')).toBeNull();
      expect(await serverCache.getCachedBranchIdByName('Centro')).toBe(3);
    });

    test('getCachedBranchList revive cada sucursal', async () => {
      const { serverCache, branchRepository } = await cargarModulo();
      branchRepository.findAllOrderedByCreatedAt.mockResolvedValue([
        branchConFechasEnTexto(),
      ]);

      const branches = await serverCache.getCachedBranchList(10);

      expect(branchRepository.findAllOrderedByCreatedAt).toHaveBeenCalledWith({
        limit: 10,
      });
      expect(branches[0].createdAt).toBeInstanceOf(Date);
    });

    test('el catálogo sin paginar usa el largo del listado como total', async () => {
      const { serverCache, catalogRepository } = await cargarModulo();
      catalogRepository.findPublicProducts.mockResolvedValue([
        productoConFechasEnTexto(),
      ]);

      const { products, total } = await serverCache.getCachedPublicCatalogBase(1);

      expect(total).toBe(1);
      expect(products[0].createdAt).toBeInstanceOf(Date);
      expect(products[0].updatedAt).toBeInstanceOf(Date);
      expect(catalogRepository.countPublicProducts).not.toHaveBeenCalled();
    });

    test('el catálogo paginado consulta el total aparte', async () => {
      const { serverCache, catalogRepository } = await cargarModulo();
      catalogRepository.findPublicProducts.mockResolvedValue([
        productoConFechasEnTexto(),
      ]);
      catalogRepository.countPublicProducts.mockResolvedValue(42);

      const { total } = await serverCache.getCachedPublicCatalogBase(1, {
        limit: 10,
        offset: 20,
      });

      expect(catalogRepository.findPublicProducts).toHaveBeenCalledWith(1, {
        limit: 10,
        offset: 20,
      });
      expect(catalogRepository.countPublicProducts).toHaveBeenCalledWith(1);
      expect(total).toBe(42);
    });
  });

  describe('con la capa deshabilitada (DATA_CACHE_REVALIDATE_S=0)', () => {
    beforeEach(() => {
      process.env.DATA_CACHE_REVALIDATE_S = '0';
    });

    test('bypasea la caché: devuelve el resultado del repositorio tal cual', async () => {
      const { serverCache, branchRepository } = await cargarModulo();
      branchRepository.findById.mockResolvedValue(branchConFechasEnTexto());

      const branch = await serverCache.getCachedBranchById(1);

      // Sin la capa no hay serialización: la fecha queda como la devolvió el repo.
      expect(branch?.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    test('getCachedPublicCatalogBase consulta directo al repositorio', async () => {
      const { serverCache, catalogRepository } = await cargarModulo();
      catalogRepository.findPublicProducts.mockResolvedValue([
        productoConFechasEnTexto(),
      ]);

      const { products, total } = await serverCache.getCachedPublicCatalogBase(1);

      expect(total).toBe(1);
      expect(products[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('invalidación por tag', () => {
    test('invalidateBranchesCache fuerza la revalidación del tag branches', async () => {
      const { serverCache, revalidateTag } = await cargarModulo();

      serverCache.invalidateBranchesCache();

      expect(revalidateTag).toHaveBeenCalledWith('branches', { expire: 0 });
    });

    test('invalidatePublicCatalogCache fuerza la revalidación del tag public-catalog', async () => {
      const { serverCache, revalidateTag } = await cargarModulo();

      serverCache.invalidatePublicCatalogCache();

      expect(revalidateTag).toHaveBeenCalledWith('public-catalog', {
        expire: 0,
      });
    });
  });
});
