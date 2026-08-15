import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as branchService from '@/application/services/branchService';
import {
  requireAuth,
  getCurrentBranchId,
  getCurrentBranchIdOrRedirect,
  requireAdmin,
} from './auth';
import { UnauthorizedError, ForbiddenError } from '@/domain/errors';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/application/services/branchService', () => ({
  getBranchById: jest.fn(),
}));

const mockedAuth = auth as unknown as jest.Mock;
const mockedCookies = cookies as unknown as jest.Mock;
const mockedRedirect = redirect as unknown as jest.Mock;
const mockedBranchService = branchService as unknown as {
  getBranchById: jest.Mock;
};

function mockCookie(value?: string) {
  mockedCookies.mockResolvedValue({
    get: jest.fn().mockReturnValue(value ? { value } : undefined),
  });
}

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
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any);
    mockCookie(undefined);

    const result = await getCurrentBranchId();

    expect(result).toBe(5);
  });

  test('admin con cookie activa devuelve la sucursal de la cookie', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockCookie('9');
    mockedBranchService.getBranchById.mockResolvedValue({
      id: 9,
      name: 'Sucursal activa',
    });

    const result = await getCurrentBranchId();

    expect(result).toBe(9);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(9);
  });

  test('admin con cookie inválida devuelve el branchId de la sesión', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockCookie('abc');

    const result = await getCurrentBranchId();

    expect(result).toBe(5);
    expect(mockedBranchService.getBranchById).not.toHaveBeenCalled();
  });

  test('admin con cookie de sucursal inexistente usa la sucursal de la sesión', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockCookie('99');
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    const result = await getCurrentBranchId();

    expect(result).toBe(5);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(99);
  });

  test('operador ignora la cookie de sucursal activa', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 3, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockCookie('9');

    const result = await getCurrentBranchId();

    expect(result).toBe(3);
    expect(mockedCookies).not.toHaveBeenCalled();
  });

  test('acepta un session pasado por parámetro sin llamar a auth', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 2, role: 'admin' },
    } as any;
    mockCookie('7');
    mockedBranchService.getBranchById.mockResolvedValue({
      id: 7,
      name: 'Sucursal 7',
    });

    const result = await getCurrentBranchId(session);

    expect(result).toBe(7);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  test('lanza UnauthorizedError cuando no hay sesión', async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(getCurrentBranchId()).rejects.toThrow(UnauthorizedError);
  });

  test('lanza ForbiddenError cuando el usuario no tiene sucursal', async () => {
    mockedAuth.mockResolvedValue({
      user: { name: 'admin', id: '1', role: 'admin' },
    } as any);

    await expect(getCurrentBranchId()).rejects.toThrow(ForbiddenError);
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

describe('getCurrentBranchIdOrRedirect', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockRedirectThrow(path: string) {
    mockedRedirect.mockImplementation((target: string) => {
      throw new Error(`NEXT_REDIRECT ${target}`);
    });
  }

  test('devuelve el branchId de la sesión', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 3, role: 'operator' },
    } as any;
    mockRedirectThrow('');

    const result = await getCurrentBranchIdOrRedirect(session);

    expect(result).toBe(3);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  test('redirige a /sucursales cuando un admin no tiene sucursal', async () => {
    const session = {
      user: { name: 'admin', id: '1', role: 'admin' },
    } as any;
    mockRedirectThrow('/sucursales');

    await expect(getCurrentBranchIdOrRedirect(session)).rejects.toThrow(
      'NEXT_REDIRECT /sucursales'
    );

    expect(mockedRedirect).toHaveBeenCalledWith('/sucursales');
  });

  test('redirige a /login con error cuando un operator no tiene sucursal', async () => {
    const session = {
      user: { name: 'operator', id: '1', role: 'operator' },
    } as any;
    mockRedirectThrow('/login?error=no_branch');

    await expect(getCurrentBranchIdOrRedirect(session)).rejects.toThrow(
      'NEXT_REDIRECT /login?error=no_branch'
    );

    expect(mockedRedirect).toHaveBeenCalledWith('/login?error=no_branch');
  });

  test('redirige a /login cuando no hay sesión', async () => {
    mockedAuth.mockResolvedValue(null);
    mockRedirectThrow('/login');

    await expect(getCurrentBranchIdOrRedirect()).rejects.toThrow(
      'NEXT_REDIRECT /login'
    );

    expect(mockedRedirect).toHaveBeenCalledWith('/login');
  });

  test('admin con cookie activa devuelve la sucursal de la cookie', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockCookie('9');
    mockedBranchService.getBranchById.mockResolvedValue({
      id: 9,
      name: 'Sucursal activa',
    });
    mockRedirectThrow('');

    const result = await getCurrentBranchIdOrRedirect(session);

    expect(result).toBe(9);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });
});
