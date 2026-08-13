import { verifyCredentials, setRateLimitStore } from './authService';
import { db } from '@/db';
import bcrypt from 'bcrypt';
import { InMemoryRateLimitStore } from '@/lib/rate-limit-store';
import { ValidationError } from '@/domain/errors';

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

function attemptFailedLogins(username: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    mockedDb.query.users.findFirst.mockResolvedValueOnce({
      id: 1,
      username,
      passwordHash: 'hash123',
      role: 'operator',
      branchId: 1,
      branch: { name: 'Sucursal por defecto' },
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(false);
  }
}

describe('authService', () => {
  beforeEach(() => {
    setRateLimitStore(new InMemoryRateLimitStore());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve el usuario cuando las credenciales son correctas', async () => {
    mockedDb.query.users.findFirst.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: 'hash123',
      role: 'admin',
      branchId: 1,
      branch: { name: 'Sucursal por defecto' },
    } as any);
    mockedBcrypt.compare.mockResolvedValue(true);

    const result = await verifyCredentials('admin', 'secreto');

    expect(result).toEqual({
      id: 1,
      username: 'admin',
      role: 'admin',
      branchId: 1,
      branchName: 'Sucursal por defecto',
    });
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
      role: 'admin',
      branchId: 1,
      branch: { name: 'Sucursal por defecto' },
    } as any);
    mockedBcrypt.compare.mockResolvedValue(false);

    const result = await verifyCredentials('admin', 'mal');

    expect(result).toBeNull();
    expect(mockedBcrypt.compare).toHaveBeenCalledWith('mal', 'hash123');
  });

  test('bloquea después de varios intentos fallidos', async () => {
    const username = 'brute';
    attemptFailedLogins(username, 5);

    for (let i = 0; i < 5; i += 1) {
      const result = await verifyCredentials(username, 'mal');
      expect(result).toBeNull();
    }

    await expect(verifyCredentials(username, 'mal')).rejects.toThrow(
      ValidationError
    );
    await expect(verifyCredentials(username, 'mal')).rejects.toThrow(
      'Demasiados intentos fallidos. Probá más tarde.'
    );
  });

  test('limpia los intentos fallidos tras un login exitoso', async () => {
    const username = 'clean';
    attemptFailedLogins(username, 4);

    for (let i = 0; i < 4; i += 1) {
      await verifyCredentials(username, 'mal');
    }

    mockedDb.query.users.findFirst.mockResolvedValueOnce({
      id: 1,
      username,
      passwordHash: 'hash123',
      role: 'operator',
      branchId: 1,
      branch: { name: 'Sucursal por defecto' },
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(true);

    const result = await verifyCredentials(username, 'secreto');

    expect(result).toEqual({
      id: 1,
      username,
      role: 'operator',
      branchId: 1,
      branchName: 'Sucursal por defecto',
    });

    mockedDb.query.users.findFirst.mockResolvedValueOnce({
      id: 1,
      username,
      passwordHash: 'hash123',
      role: 'operator',
      branchId: 1,
      branch: { name: 'Sucursal por defecto' },
    } as any);
    mockedBcrypt.compare.mockResolvedValueOnce(false);

    const afterSuccess = await verifyCredentials(username, 'mal');
    expect(afterSuccess).toBeNull();
  });
});
