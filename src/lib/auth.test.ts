import { auth } from '@/auth';
import { requireAuth } from './auth';
import { UnauthorizedError } from '@/domain/errors';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

const mockedAuth = auth as unknown as jest.Mock;

describe('requireAuth', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve la sesión cuando el usuario está autenticado', async () => {
    const session = { user: { name: 'admin', id: '1' } } as any;
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
});
