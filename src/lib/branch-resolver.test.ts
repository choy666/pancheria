import {
  parseBranchId,
  listPublicBranches,
  getDefaultBranchId,
  resolvePublicBranchId,
} from './branch-resolver';
import * as branchRepository from '@/repositories/branchRepository';
import { branches } from '@/db/schema';

// El resolver consulta a través de la capa de caché de servidor
// (`src/lib/server-cache.ts`), que en tests es passthrough y termina en el
// repositorio: por eso el mock va sobre `@/repositories/branchRepository`.
jest.mock('@/repositories/branchRepository');

const mockedBranchRepository = branchRepository as jest.Mocked<
  typeof branchRepository
>;

type BranchRow = typeof branches.$inferSelect;

const DEFAULT_BRANCH_NAME = 'Sucursal por defecto';

const ORIGINAL_DEFAULT_BRANCH_NAME = process.env.DEFAULT_BRANCH_NAME;

function restoreDefaultBranchName() {
  if (ORIGINAL_DEFAULT_BRANCH_NAME === undefined) {
    delete process.env.DEFAULT_BRANCH_NAME;
  } else {
    process.env.DEFAULT_BRANCH_NAME = ORIGINAL_DEFAULT_BRANCH_NAME;
  }
}

function makeBranch(id: number, name: string): BranchRow {
  return {
    id,
    name,
    openingHours: [],
    address: null,
    phones: [],
    socialLinks: [],
    isActive: true,
    location: null,
    createdAt: new Date(),
  };
}

describe('branch-resolver', () => {
  afterEach(() => {
    jest.clearAllMocks();
    restoreDefaultBranchName();
  });

  describe('parseBranchId', () => {
    test('devuelve null para valores inválidos', () => {
      expect(parseBranchId('abc')).toBeNull();
      expect(parseBranchId('-1')).toBeNull();
      expect(parseBranchId('0')).toBeNull();
      expect(parseBranchId('1.5')).toBeNull();
      expect(parseBranchId('')).toBeNull();
      expect(parseBranchId(null)).toBeNull();
      expect(parseBranchId(undefined)).toBeNull();
      expect(parseBranchId({})).toBeNull();
    });

    test('devuelve el id para enteros positivos', () => {
      expect(parseBranchId('1')).toBe(1);
      expect(parseBranchId(42)).toBe(42);
      expect(parseBranchId('  7  ')).toBe(7);
    });
  });

  describe('getDefaultBranchId', () => {
    test('devuelve null si DEFAULT_BRANCH_NAME no está configurado', async () => {
      delete process.env.DEFAULT_BRANCH_NAME;

      const result = await getDefaultBranchId();

      expect(result).toBeNull();
      expect(mockedBranchRepository.findByName).not.toHaveBeenCalled();
      expect(
        mockedBranchRepository.findAllOrderedByCreatedAt
      ).not.toHaveBeenCalled();
    });

    test('devuelve null si la sucursal no existe', async () => {
      process.env.DEFAULT_BRANCH_NAME = DEFAULT_BRANCH_NAME;
      mockedBranchRepository.findByName.mockResolvedValue(undefined);

      const result = await getDefaultBranchId();

      expect(result).toBeNull();
      expect(mockedBranchRepository.findByName).toHaveBeenCalledWith(
        DEFAULT_BRANCH_NAME
      );
    });

    test('devuelve el id de la sucursal configurada', async () => {
      process.env.DEFAULT_BRANCH_NAME = DEFAULT_BRANCH_NAME;
      mockedBranchRepository.findByName.mockResolvedValue(
        makeBranch(1, DEFAULT_BRANCH_NAME)
      );

      const result = await getDefaultBranchId();

      expect(result).toBe(1);
    });

    test('ignora espacios en DEFAULT_BRANCH_NAME', async () => {
      process.env.DEFAULT_BRANCH_NAME = `  ${DEFAULT_BRANCH_NAME}  `;
      mockedBranchRepository.findByName.mockResolvedValue(
        makeBranch(1, DEFAULT_BRANCH_NAME)
      );

      const result = await getDefaultBranchId();

      expect(result).toBe(1);
      expect(mockedBranchRepository.findByName).toHaveBeenCalledWith(
        DEFAULT_BRANCH_NAME
      );
    });

    test('devuelve null si la sucursal por defecto está inactiva (sin fallback)', async () => {
      process.env.DEFAULT_BRANCH_NAME = DEFAULT_BRANCH_NAME;
      mockedBranchRepository.findByName.mockResolvedValue({
        ...makeBranch(1, DEFAULT_BRANCH_NAME),
        isActive: false,
      });

      const result = await getDefaultBranchId();

      expect(result).toBeNull();
      // No hay fallback a otra activa: ni siquiera se consulta el listado.
      expect(
        mockedBranchRepository.findAllOrderedByCreatedAt
      ).not.toHaveBeenCalled();
    });
  });

  describe('resolvePublicBranchId', () => {
    test('con param devuelve el id si la sucursal existe y está activa', async () => {
      mockedBranchRepository.findById.mockResolvedValue(
        makeBranch(7, 'Sucursal B')
      );

      expect(await resolvePublicBranchId(7)).toBe(7);
      expect(mockedBranchRepository.findById).toHaveBeenCalledWith(7);
    });

    test('con param devuelve null si la sucursal está inactiva', async () => {
      mockedBranchRepository.findById.mockResolvedValue({
        ...makeBranch(7, 'Sucursal B'),
        isActive: false,
      });

      expect(await resolvePublicBranchId(7)).toBeNull();
    });

    test('con param devuelve null si la sucursal no existe', async () => {
      mockedBranchRepository.findById.mockResolvedValue(undefined);

      expect(await resolvePublicBranchId(99)).toBeNull();
    });

    test('sin param delega a la sucursal por defecto', async () => {
      process.env.DEFAULT_BRANCH_NAME = DEFAULT_BRANCH_NAME;
      mockedBranchRepository.findByName.mockResolvedValue(
        makeBranch(1, DEFAULT_BRANCH_NAME)
      );

      expect(await resolvePublicBranchId(null)).toBe(1);
      expect(await resolvePublicBranchId(undefined)).toBe(1);
    });

    test('sin param devuelve null si la por defecto está inactiva', async () => {
      process.env.DEFAULT_BRANCH_NAME = DEFAULT_BRANCH_NAME;
      mockedBranchRepository.findByName.mockResolvedValue({
        ...makeBranch(1, DEFAULT_BRANCH_NAME),
        isActive: false,
      });

      expect(await resolvePublicBranchId(null)).toBeNull();
    });
  });

  describe('listPublicBranches', () => {
    test('mapea las sucursales al DTO público', async () => {
      const branchesList = [makeBranch(1, 'Sucursal A')];
      mockedBranchRepository.findAllOrderedByCreatedAt.mockResolvedValue(
        branchesList
      );

      const result = await listPublicBranches();

      expect(result).toEqual(branchesList);
    });

    test('expone teléfonos y redes sociales de la sucursal', async () => {
      const branch: BranchRow = {
        ...makeBranch(2, 'Sucursal B'),
        address: 'Calle 123',
        phones: [{ label: 'Pedidos', number: '3415555555' }],
        socialLinks: [{ network: 'instagram', url: '@sucursal.b' }],
        location: 'https://maps.example.com/b',
      };
      mockedBranchRepository.findAllOrderedByCreatedAt.mockResolvedValue([
        branch,
      ]);

      const result = await listPublicBranches();

      expect(result).toEqual([branch]);
    });
  });
});
