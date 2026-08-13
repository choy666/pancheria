import { auth } from '@/auth';
import { requireAuth, getCurrentBranchId, requireAdmin } from './auth';
import { UnauthorizedError, ForbiddenError } from '@/domain/errors';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

const mockedAuth = auth as unknown as jest.Mock;

describe('requireAuth', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve la sesión cuando el usuario está autenticado con sucursal', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 1, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);

    const result = await requireAuth();

    expect(result).toBe(session);
    expect(mockedAuth).toHaveBeenCalledTimes(1);
  });

  test('lanza UnauthorizedError cuando no hay sesión', async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
    await expect(requireAuth()).rejects.toThrow(
      'Se requiere iniciar sesión.'
    );
  });

  test('lanza ForbiddenError cuando el usuario no tiene sucursal', async () => {
    mockedAuth.mockResolvedValue({
      user: { name: 'admin', id: '1' },
    } as any);

    await expect(requireAuth()).rejects.toThrow(ForbiddenError);
  });
});

describe('getCurrentBranchId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve el branchId de la sesión', async () => {
    mockedAuth.mockResolvedValue({
      user: { name: 'admin', id: '1', branchId: 5 },
    } as any);

    const result = await getCurrentBranchId();

    expect(result).toBe(5);
  });

  test('lanza UnauthorizedError cuando no hay sesión', async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(getCurrentBranchId()).rejects.toThrow(UnauthorizedError);
  });
});

describe('requireAdmin', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve la sesión cuando el usuario es admin', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 1, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);

    const result = await requireAdmin();

    expect(result).toBe(session);
  });

  test('lanza ForbiddenError cuando el usuario no es admin', async () => {
    mockedAuth.mockResolvedValue({
      user: { name: 'operator', id: '1', branchId: 1, role: 'operator' },
    } as any);

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
  });
});
