import { verifyCredentials } from './authService';
import { db } from '@/db';
import bcrypt from 'bcrypt';

jest.mock('@/db', () => ({
  db: {
    query: {
      users: {
        findFirst: jest.fn(),
      },
    },
  },
}));

jest.mock('bcrypt');

const mockedDb = db as unknown as {
  query: {
    users: {
      findFirst: jest.Mock;
    };
  };
};

const mockedBcrypt = bcrypt as unknown as {
  compare: jest.Mock;
};

describe('authService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve el usuario cuando las credenciales son correctas', async () => {
    mockedDb.query.users.findFirst.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash123',
    } as any);
    mockedBcrypt.compare.mockResolvedValue(true);

    const result = await verifyCredentials('admin', 'secreto');

    expect(result).toEqual({ id: 1, username: 'admin' });
    expect(mockedDb.query.users.findFirst).toHaveBeenCalled();
    expect(mockedBcrypt.compare).toHaveBeenCalledWith('secreto', 'hash123');
  });

  test('devuelve null si el usuario no existe', async () => {
    mockedDb.query.users.findFirst.mockResolvedValue(undefined);

    const result = await verifyCredentials('admin', 'secreto');

    expect(result).toBeNull();
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
  });

  test('devuelve null si la contraseña es incorrecta', async () => {
    mockedDb.query.users.findFirst.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash123',
    } as any);
    mockedBcrypt.compare.mockResolvedValue(false);

    const result = await verifyCredentials('admin', 'mal');

    expect(result).toBeNull();
    expect(mockedBcrypt.compare).toHaveBeenCalledWith('mal', 'hash123');
  });
});
