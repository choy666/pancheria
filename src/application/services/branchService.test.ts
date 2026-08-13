import { listBranches, getBranchById, createBranch } from './branchService';
import { db } from '@/db';
import { ValidationError } from '@/domain/errors';

jest.mock('@/db', () => ({
  db: {
    query: {
      branches: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(),
  },
}));

const mockedDb = db as unknown as {
  query: {
    branches: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  insert: jest.Mock;
};

const mockReturning = jest.fn();

describe('branchService', () => {
  beforeEach(() => {
    mockedDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({ returning: mockReturning }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listBranches', () => {
    test('devuelve todas las sucursales ordenadas por createdAt descendente', async () => {
      const expected = [
        { id: 2, name: 'Sucursal B', createdAt: new Date() },
        { id: 1, name: 'Sucursal A', createdAt: new Date() },
      ];
      mockedDb.query.branches.findMany.mockResolvedValue(expected);

      const result = await listBranches();

      expect(result).toEqual(expected);
      expect(mockedDb.query.branches.findMany).toHaveBeenCalled();
    });
  });

  describe('getBranchById', () => {
    test('devuelve la sucursal por id', async () => {
      const expected = { id: 1, name: 'Sucursal A' };
      mockedDb.query.branches.findFirst.mockResolvedValue(expected);

      const result = await getBranchById(1);

      expect(result).toEqual(expected);
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalled();
    });

    test('devuelve undefined si no existe', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const result = await getBranchById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('createBranch', () => {
    test('crea una sucursal nueva', async () => {
      mockReturning.mockResolvedValue([{ id: 1, name: 'Sucursal Nueva' }]);
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      const result = await createBranch('Sucursal Nueva');

      expect(result).toEqual({ id: 1, name: 'Sucursal Nueva' });
    });

    test('rechaza un nombre vacío', async () => {
      await expect(createBranch('   ')).rejects.toThrow(ValidationError);
      await expect(createBranch('   ')).rejects.toThrow(
        'El nombre de la sucursal es obligatorio.'
      );
    });

    test('rechaza un nombre duplicado', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue({
        id: 2,
        name: 'Existente',
      });

      await expect(createBranch('Existente')).rejects.toThrow(ValidationError);
      await expect(createBranch('Existente')).rejects.toThrow(
        'Ya existe una sucursal con ese nombre.'
      );
    });
  });
});
