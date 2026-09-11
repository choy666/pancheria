import * as userRepository from './userRepository';

var mockFindFirst: jest.Mock;
var mockFindMany: jest.Mock;
var mockReturning: jest.Mock;
var mockValues: jest.Mock;
var mockInsert: jest.Mock;
var mockWhereReturning: jest.Mock;
var mockSet: jest.Mock;
var mockUpdate: jest.Mock;
var mockDeleteWhere: jest.Mock;
var mockDelete: jest.Mock;
var mockGetCurrentTransaction: jest.Mock;

jest.mock('@/db', () => {
  mockFindFirst = jest.fn();
  mockFindMany = jest.fn();
  mockReturning = jest.fn();
  mockValues = jest.fn((data: unknown) => ({ returning: mockReturning }));
  mockInsert = jest.fn(() => ({ values: mockValues }));
  mockWhereReturning = jest.fn(() => ({ returning: mockReturning }));
  mockSet = jest.fn(() => ({ where: mockWhereReturning }));
  mockUpdate = jest.fn(() => ({ set: mockSet }));
  mockDeleteWhere = jest.fn();
  mockDelete = jest.fn(() => ({ where: mockDeleteWhere }));

  return {
    db: {
      query: {
        users: { findFirst: mockFindFirst, findMany: mockFindMany },
      },
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  };
});

jest.mock('@/application/transactionService', () => {
  mockGetCurrentTransaction = jest.fn();
  return { getCurrentTransaction: mockGetCurrentTransaction };
});

const BRANCH_ID = 1;

describe('userRepository', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    test('devuelve todos los usuarios ordenados por createdAt', async () => {
      const expected = [{ id: 1, username: 'admin' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await userRepository.findAll();

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ with: { branch: true }, orderBy: expect.anything() })
      );
    });

    test('puede filtrar por branchId', async () => {
      const expected = [{ id: 1, username: 'admin' }];
      mockFindMany.mockResolvedValue(expected);

      const result = await userRepository.findAll(BRANCH_ID);

      expect(result).toEqual(expected);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: { branch: true },
          orderBy: expect.anything(),
        })
      );
    });
  });

  describe('findById', () => {
    test('devuelve un usuario por su id', async () => {
      const expected = { id: 1, username: 'admin' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await userRepository.findById(1);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve undefined si el usuario no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await userRepository.findById(999);

      expect(result).toBeUndefined();
    });

    test('usa la transacción si se provee', async () => {
      const txFindFirst = jest.fn().mockResolvedValue({ id: 1 });
      const tx: any = { query: { users: { findFirst: txFindFirst } } };

      const result = await userRepository.findById(1, tx);

      expect(result).toEqual({ id: 1 });
      expect(txFindFirst).toHaveBeenCalled();
    });
  });

  describe('findByUsername', () => {
    test('devuelve un usuario por su username', async () => {
      const expected = { id: 1, username: 'admin' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await userRepository.findByUsername('admin');

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });

    test('devuelve undefined si no existe', async () => {
      mockFindFirst.mockResolvedValue(undefined);

      const result = await userRepository.findByUsername('inexistente');

      expect(result).toBeUndefined();
    });
  });

  describe('findByUsernameWithBranch', () => {
    test('devuelve un usuario con su sucursal', async () => {
      const expected = { id: 1, username: 'admin', branch: { id: 1 } };
      mockFindFirst.mockResolvedValue(expected);

      const result = await userRepository.findByUsernameWithBranch('admin');

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: { branch: true },
        })
      );
    });
  });

  describe('findByUsernameExcludingId', () => {
    test('busca username excluyendo un id', async () => {
      const expected = { id: 2, username: 'admin' };
      mockFindFirst.mockResolvedValue(expected);

      const result = await userRepository.findByUsernameExcludingId('admin', 1);

      expect(result).toEqual(expected);
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.anything() })
      );
    });
  });

  describe('insert', () => {
    test('inserta un usuario y devuelve el registro', async () => {
      const data = {
        username: 'nuevo',
        passwordHash: 'hash',
        role: 'operator' as const,
        branchId: BRANCH_ID,
      };
      const expected = { id: 1, ...data };
      mockReturning.mockResolvedValue([expected]);

      const result = await userRepository.insert(data);

      expect(result).toEqual(expected);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(data);
    });

    test('devuelve null si no hay filas devueltas', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await userRepository.insert({
        username: 'nuevo',
        passwordHash: 'hash',
        role: 'operator',
        branchId: BRANCH_ID,
      });

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    test('actualiza un usuario y devuelve el registro', async () => {
      const expected = { id: 1, role: 'admin' };
      mockReturning.mockResolvedValue([expected]);

      const result = await userRepository.update(1, { role: 'admin' });

      expect(result).toEqual(expected);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ role: 'admin' });
    });

    test('devuelve null si el usuario no existe', async () => {
      mockReturning.mockResolvedValue([]);

      const result = await userRepository.update(999, { role: 'admin' });

      expect(result).toBeNull();
    });

    test('usa la transacción si se provee', async () => {
      const txReturning = jest.fn().mockResolvedValue([{ id: 1, role: 'admin' }]);
      const txWhereReturning = jest.fn(() => ({ returning: txReturning }));
      const txSet = jest.fn(() => ({ where: txWhereReturning }));
      const txUpdate = jest.fn(() => ({ set: txSet }));
      const tx: any = { update: txUpdate };

      const result = await userRepository.update(1, { role: 'admin' }, tx);

      expect(result).toEqual({ id: 1, role: 'admin' });
      expect(txUpdate).toHaveBeenCalled();
      expect(txSet).toHaveBeenCalledWith({ role: 'admin' });
    });
  });

  describe('deleteById', () => {
    test('elimina un usuario por su id', async () => {
      await userRepository.deleteById(1);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });
  });
});
