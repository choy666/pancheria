import {
  parseBranchId,
  listPublicBranches,
  getDefaultBranchId,
} from './branch-resolver';
import * as branchService from '@/application/services/branchService';
import type { Branch } from '@/domain/types';

jest.mock('@/application/services/branchService');

const mockedBranchService = branchService as jest.Mocked<typeof branchService>;

const DEFAULT_BRANCH_NAME = 'Sucursal por defecto';

const ORIGINAL_DEFAULT_BRANCH_NAME = process.env.DEFAULT_BRANCH_NAME;

function restoreDefaultBranchName() {
  if (ORIGINAL_DEFAULT_BRANCH_NAME === undefined) {
    delete process.env.DEFAULT_BRANCH_NAME;
  } else {
    process.env.DEFAULT_BRANCH_NAME = ORIGINAL_DEFAULT_BRANCH_NAME;
  }
}

function makeBranch(id: number, name: string): Branch {
  return { id, name, openingHours: [], createdAt: new Date() };
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
      mockedBranchService.listBranches.mockResolvedValue([]);

      const result = await getDefaultBranchId();

      expect(result).toBeNull();
      expect(mockedBranchService.listBranches).not.toHaveBeenCalled();
    });

    test('devuelve null si la sucursal no existe', async () => {
      process.env.DEFAULT_BRANCH_NAME = DEFAULT_BRANCH_NAME;
      mockedBranchService.listBranches.mockResolvedValue([
        makeBranch(1, 'Otra sucursal'),
      ]);

      const result = await getDefaultBranchId();

      expect(result).toBeNull();
    });

    test('devuelve el id de la sucursal configurada', async () => {
      process.env.DEFAULT_BRANCH_NAME = DEFAULT_BRANCH_NAME;
      mockedBranchService.listBranches.mockResolvedValue([
        makeBranch(1, DEFAULT_BRANCH_NAME),
      ]);

      const result = await getDefaultBranchId();

      expect(result).toBe(1);
    });

    test('ignora espacios en DEFAULT_BRANCH_NAME', async () => {
      process.env.DEFAULT_BRANCH_NAME = `  ${DEFAULT_BRANCH_NAME}  `;
      mockedBranchService.listBranches.mockResolvedValue([
        makeBranch(1, DEFAULT_BRANCH_NAME),
      ]);

      const result = await getDefaultBranchId();

      expect(result).toBe(1);
    });
  });

  describe('listPublicBranches', () => {
    test('mapea las sucursales al DTO público', async () => {
      const branches = [makeBranch(1, 'Sucursal A')];
      mockedBranchService.listBranches.mockResolvedValue(branches);

      const result = await listPublicBranches();

      expect(result).toEqual(branches);
    });
  });
});
