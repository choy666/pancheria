import {
  listBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
} from './branchService';
import { db } from '@/db';
import { NotFoundError, ValidationError } from '@/domain/errors';

jest.mock('@/db', () => ({
  db: {
    query: {
      branches: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
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
  update: jest.Mock;
  delete: jest.Mock;
  transaction: jest.Mock;
};

const mockReturning = jest.fn();
const mockUpdateReturning = jest.fn();

describe('branchService', () => {
  beforeEach(() => {
    mockedDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({ returning: mockReturning }),
    });
    mockedDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: mockUpdateReturning,
        }),
      }),
    });

    const mockTx = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockReturnThis(),
    };

    mockedDb.transaction.mockImplementation(async (callback) => {
      await callback(mockTx);
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

  describe('updateBranch', () => {
    test('actualiza una sucursal existente', async () => {
      mockedDb.query.branches.findFirst
        .mockResolvedValueOnce({ id: 1, name: 'Sucursal A' })
        .mockResolvedValueOnce(undefined);
      mockUpdateReturning.mockResolvedValue([{ id: 1, name: 'Sucursal Nueva' }]);

      const result = await updateBranch(1, 'Sucursal Nueva');

      expect(result).toEqual({ id: 1, name: 'Sucursal Nueva' });
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalledTimes(2);
      expect(mockedDb.update).toHaveBeenCalled();
    });

    test('rechaza un nombre vacío', async () => {
      await expect(updateBranch(1, '   ')).rejects.toThrow(ValidationError);
      await expect(updateBranch(1, '   ')).rejects.toThrow(
        'El nombre de la sucursal es obligatorio.'
      );
    });

    test('rechaza un nombre duplicado con otra sucursal', async () => {
      mockedDb.query.branches.findFirst
        .mockResolvedValueOnce({ id: 1, name: 'Sucursal A' })
        .mockResolvedValueOnce({ id: 2, name: 'Sucursal B' });

      await expect(updateBranch(1, 'Sucursal B')).rejects.toThrow(
        ValidationError
      );
      await expect(updateBranch(1, 'Sucursal B')).rejects.toThrow(
        'Ya existe otra sucursal con ese nombre.'
      );
    });

    test('permite guardar el mismo nombre de la sucursal que se está editando', async () => {
      mockedDb.query.branches.findFirst
        .mockResolvedValueOnce({ id: 1, name: 'Sucursal A' })
        .mockResolvedValueOnce(undefined);
      mockUpdateReturning.mockResolvedValue([{ id: 1, name: 'Sucursal A' }]);

      const result = await updateBranch(1, 'Sucursal A');

      expect(result).toEqual({ id: 1, name: 'Sucursal A' });
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalledTimes(2);
    });

    test('lanza NotFoundError para un ID inexistente', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      await expect(updateBranch(999, 'Sucursal Inexistente')).rejects.toThrow(
        NotFoundError
      );
      await expect(updateBranch(999, 'Sucursal Inexistente')).rejects.toThrow(
        'Sucursal con ID 999 no encontrado.'
      );
    });
  });

  describe('deleteBranch', () => {
    test('elimina una sucursal y sus datos en cascada', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue({
        id: 1,
        name: 'Sucursal A',
      });

      const result = await deleteBranch(1);

      expect(result).toEqual({ id: 1, name: 'Sucursal A' });
      expect(mockedDb.query.branches.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        })
      );
      expect(mockedDb.transaction).toHaveBeenCalled();
    });

    test('lanza NotFoundError para un ID inexistente', async () => {
      mockedDb.query.branches.findFirst.mockResolvedValue(undefined);

      await expect(deleteBranch(999)).rejects.toThrow(NotFoundError);
      await expect(deleteBranch(999)).rejects.toThrow(
        'Sucursal con ID 999 no encontrado.'
      );
    });
  });
});
