import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} from './userService';
import { db } from '@/db';
import * as branchService from '@/application/services/branchService';
import bcrypt from 'bcrypt';
import { ValidationError, NotFoundError } from '@/domain/errors';

jest.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/application/services/branchService');
jest.mock('bcrypt');

const mockedDb = db as unknown as {
  query: {
    users: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

const mockedBranchService = branchService as jest.Mocked<typeof branchService>;
const mockedBcrypt = bcrypt as unknown as { hash: jest.Mock };
const mockReturning = jest.fn();

function createMockUpdateChain() {
  const where = jest.fn().mockReturnValue({ returning: mockReturning });
  const set = jest.fn().mockReturnValue({ where });
  return { set, where };
}

const mockUpdateChain = createMockUpdateChain();
const mockDeleteWhere = jest.fn().mockResolvedValue(undefined);

function mockAdminUser() {
  return {
    id: 1,
    username: 'admin',
    role: 'admin',
    branchId: 1,
    passwordHash: 'hash',
    createdAt: new Date(),
  };
}

function mockOperatorUser() {
  return {
    id: 2,
    username: 'operator',
    role: 'operator',
    branchId: 1,
    passwordHash: 'hash',
    createdAt: new Date(),
  };
}

describe('userService', () => {
  beforeEach(() => {
    mockedDb.query.users.findFirst.mockReset();
    mockedDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({ returning: mockReturning }),
    });
    mockedDb.update.mockReturnValue(mockUpdateChain);
    mockedDb.delete.mockReturnValue({
      where: mockDeleteWhere,
    });
    mockedBcrypt.hash.mockResolvedValue('hashed');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    test('devuelve los usuarios filtrados por sucursal', async () => {
      const expected = [
        {
          id: 1,
          username: 'admin',
          role: 'admin',
          branchId: 1,
          branch: { id: 1, name: 'Sucursal A', openingHours: [] },
        },
      ];
      mockedDb.query.users.findMany.mockResolvedValue(expected as any);

      const result = await listUsers(1);

      expect(result).toEqual(expected);
      expect(mockedDb.query.users.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
          with: expect.objectContaining({ branch: true }),
          orderBy: expect.anything(),
        })
      );
    });
  });

  describe('createUser', () => {
    test('crea un usuario operador correctamente', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: 1,
        name: 'Sucursal A',
      } as any);
      mockedDb.query.users.findFirst.mockResolvedValue(undefined);
      mockReturning.mockResolvedValue([
        { id: 1, username: 'nuevo', role: 'operator', branchId: 1 },
      ]);

      const result = await createUser({
        username: 'nuevo',
        password: '123456',
        role: 'operator',
        branchId: 1,
      });

      expect(result.username).toBe('nuevo');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('123456', 10);
    });

    test('rechaza un nombre de usuario vacío', async () => {
      await expect(
        createUser({
          username: '   ',
          password: '123456',
          role: 'operator',
          branchId: 1,
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza una contraseña demasiado corta', async () => {
      await expect(
        createUser({
          username: 'nuevo',
          password: '123',
          role: 'operator',
          branchId: 1,
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza crear un usuario administrador', async () => {
      await expect(
        createUser({
          username: 'nuevo',
          password: '123456',
          role: 'admin',
          branchId: 1,
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza una sucursal inexistente', async () => {
      mockedBranchService.getBranchById.mockResolvedValue(undefined);

      await expect(
        createUser({
          username: 'nuevo',
          password: '123456',
          role: 'operator',
          branchId: 99,
        })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza un nombre de usuario duplicado', async () => {
      mockedBranchService.getBranchById.mockResolvedValue({
        id: 1,
        name: 'Sucursal A',
      } as any);
      mockedDb.query.users.findFirst.mockResolvedValue({
        id: 2,
        username: 'existente',
      } as any);

      await expect(
        createUser({
          username: 'existente',
          password: '123456',
          role: 'operator',
          branchId: 1,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateUser', () => {
    test('edita un usuario operador correctamente', async () => {
      mockedDb.query.users.findFirst
        .mockResolvedValueOnce(mockOperatorUser() as any)
        .mockResolvedValueOnce(undefined);
      mockReturning.mockResolvedValue([
        { id: 2, username: 'nuevo-nombre', role: 'operator', branchId: 1 },
      ]);

      const result = await updateUser(2, { username: 'nuevo-nombre' });

      expect(result.username).toBe('nuevo-nombre');
      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'nuevo-nombre' })
      );
    });

    test('edita un usuario operador con contraseña correctamente', async () => {
      mockedDb.query.users.findFirst
        .mockResolvedValueOnce(mockOperatorUser() as any)
        .mockResolvedValueOnce(undefined);
      mockReturning.mockResolvedValue([
        {
          id: 2,
          username: 'operator',
          role: 'operator',
          branchId: 1,
        },
      ]);

      const result = await updateUser(2, { password: 'nueva-contraseña' });

      expect(result.id).toBe(2);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('nueva-contraseña', 10);
      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: 'hashed' })
      );
    });

    test('no actualiza la contraseña si se envía vacía', async () => {
      mockedDb.query.users.findFirst
        .mockResolvedValueOnce(mockOperatorUser() as any)
        .mockResolvedValueOnce(undefined);
      mockReturning.mockResolvedValue([
        { id: 2, username: 'operator', role: 'operator', branchId: 1 },
      ]);

      const result = await updateUser(2, {
        username: 'operator',
        password: '',
      });

      expect(result.username).toBe('operator');
      expect(mockedBcrypt.hash).not.toHaveBeenCalled();
      expect(mockUpdateChain.set).not.toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: expect.anything() })
      );
    });

    test('rechaza editar un usuario administrador', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(mockAdminUser() as any);

      await expect(updateUser(1, { username: 'otro' })).rejects.toThrow(
        ValidationError
      );
    });

    test('rechaza un nombre de usuario vacío', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(mockOperatorUser() as any);

      await expect(updateUser(2, { username: '   ' })).rejects.toThrow(
        ValidationError
      );
    });

    test('rechaza un nombre de usuario duplicado', async () => {
      mockedDb.query.users.findFirst
        .mockResolvedValueOnce(mockOperatorUser() as any)
        .mockResolvedValueOnce({
          id: 3,
          username: 'existente',
        } as any);

      await expect(
        updateUser(2, { username: 'existente' })
      ).rejects.toThrow(ValidationError);
    });

    test('rechaza una sucursal inexistente', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(mockOperatorUser() as any);
      mockedBranchService.getBranchById.mockResolvedValue(undefined);

      await expect(updateUser(2, { branchId: 99 })).rejects.toThrow(
        ValidationError
      );
    });

    test('rechaza una contraseña demasiado corta', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(mockOperatorUser() as any);

      await expect(updateUser(2, { password: '123' })).rejects.toThrow(
        ValidationError
      );
    });

    test('lanza NotFoundError si el usuario no existe', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(undefined);

      await expect(updateUser(999, { username: 'otro' })).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteUser', () => {
    test('elimina un usuario operador correctamente', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(mockOperatorUser() as any);

      await expect(deleteUser(2)).resolves.toBeUndefined();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    test('rechaza eliminar un usuario administrador', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(mockAdminUser() as any);

      await expect(deleteUser(1)).rejects.toThrow(ValidationError);
      expect(mockDeleteWhere).not.toHaveBeenCalled();
    });

    test('lanza NotFoundError si el usuario no existe', async () => {
      mockedDb.query.users.findFirst.mockResolvedValueOnce(undefined);

      await expect(deleteUser(999)).rejects.toThrow(NotFoundError);
    });
  });
});
