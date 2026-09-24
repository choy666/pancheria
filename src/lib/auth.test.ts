import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import * as branchService from '@/application/services/branchService';
import * as userRepository from '@/repositories/userRepository';
import {
  requireAuth,
  getCurrentBranchId,
  getCurrentBranchIdOrRedirect,
  requireAdmin,
} from './auth';
import {
  UnauthorizedError,
  ForbiddenError,
  BranchRemovedError,
  UserRemovedError,
} from '@/domain/errors';

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

jest.mock('@/repositories/userRepository', () => ({
  findByIdWithBranch: jest.fn(),
}));

const mockedAuth = auth as unknown as jest.Mock;
const mockedCookies = cookies as unknown as jest.Mock;
const mockedRedirect = redirect as unknown as jest.Mock;
const mockedBranchService = branchService as unknown as {
  getBranchById: jest.Mock;
};
const mockedUserRepository = userRepository as unknown as {
  findByIdWithBranch: jest.Mock;
};

function mockCookie(value?: string) {
  mockedCookies.mockResolvedValue({
    get: jest.fn().mockReturnValue(value ? { value } : undefined),
  });
}

/**
 * Mockea el usuario vigente en base con los mismos branchId/role que lleva
 * la sesión (el caso común: JWT al día).
 */
function mockDbUserFromSession(session: { user: Record<string, unknown> }) {
  mockedUserRepository.findByIdWithBranch.mockResolvedValue({
    id: Number(session.user.id),
    role: session.user.role,
    branchId: session.user.branchId,
    branch: { name: session.user.branchName ?? 'Sucursal' },
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
    mockDbUserFromSession(session);
    mockedBranchService.getBranchById.mockResolvedValue({ id: 1 });

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

  test('lanza UserRemovedError cuando el usuario de la sesión ya no existe en base', async () => {
    mockedAuth.mockResolvedValue({
      user: { name: 'operator', id: '1', branchId: 1, role: 'operator' },
    } as any);
    mockedUserRepository.findByIdWithBranch.mockResolvedValue(undefined);

    const error = await requireAuth().catch((e) => e);
    expect(error).toBeInstanceOf(UserRemovedError);
    // Hereda de ForbiddenError: las rutas lo mapean a 403 con code.
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.code).toBe('USER_REMOVED');
  });

  test('sincroniza branchId y role desde la base (JWT viejo)', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 1, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    // El usuario fue reasignado y promovido después de emitir el JWT.
    mockedUserRepository.findByIdWithBranch.mockResolvedValue({
      id: 1,
      role: 'admin',
      branchId: 7,
      branch: { name: 'Sucursal nueva' },
    });
    mockedBranchService.getBranchById.mockResolvedValue({ id: 7 });

    const result = await requireAuth();

    expect(result.user.branchId).toBe(7);
    expect(result.user.role).toBe('admin');
    expect(result.user.branchName).toBe('Sucursal nueva');
    // La validación de existencia corre contra la sucursal vigente, no la del JWT.
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(7);
  });

  test('lanza ForbiddenError cuando el usuario no tiene sucursal', async () => {
    mockedAuth.mockResolvedValue({
      user: { name: 'admin', id: '1' },
    } as any);
    mockedUserRepository.findByIdWithBranch.mockResolvedValue({
      id: 1,
      role: 'admin',
      branchId: null,
      branch: null,
    });

    await expect(requireAuth()).rejects.toThrow(ForbiddenError);
  });

  test('lanza BranchRemovedError cuando la sucursal de la sesión fue eliminada', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 5, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    const error = await requireAuth().catch((e) => e);
    expect(error).toBeInstanceOf(BranchRemovedError);
    // Hereda de ForbiddenError: las rutas lo mapean a 403 como antes.
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.code).toBe('BRANCH_REMOVED');
    expect(error.message).toBe('La sucursal asignada ya no existe.');
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(5);
  });
});

describe('getCurrentBranchId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('devuelve el branchId de la sesión', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockCookie(undefined);
    mockedBranchService.getBranchById.mockResolvedValue({ id: 5 });

    const result = await getCurrentBranchId();

    expect(result).toBe(5);
  });

  test('devuelve la sucursal vigente en base aunque el JWT tenga otra', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 5, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    // Reasignación posterior a la emisión del JWT (D4).
    mockedUserRepository.findByIdWithBranch.mockResolvedValue({
      id: 1,
      role: 'operator',
      branchId: 8,
      branch: { name: 'Sucursal nueva' },
    });
    mockedBranchService.getBranchById.mockResolvedValue({ id: 8 });

    const result = await getCurrentBranchId();

    expect(result).toBe(8);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(8);
    expect(mockedBranchService.getBranchById).not.toHaveBeenCalledWith(5);
  });

  test('lanza UserRemovedError cuando el usuario ya no existe en base', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 5, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockedUserRepository.findByIdWithBranch.mockResolvedValue(undefined);

    const error = await getCurrentBranchId().catch((e) => e);
    expect(error).toBeInstanceOf(UserRemovedError);
    expect(error.code).toBe('USER_REMOVED');
    expect(mockedBranchService.getBranchById).not.toHaveBeenCalled();
  });

  test('admin con cookie activa devuelve la sucursal de la cookie', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
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
    mockDbUserFromSession(session);
    mockCookie('abc');
    mockedBranchService.getBranchById.mockResolvedValue({ id: 5 });

    const result = await getCurrentBranchId();

    expect(result).toBe(5);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(5);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledTimes(1);
  });

  test('admin con cookie de sucursal inexistente usa la sucursal de la sesión', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockCookie('99');
    mockedBranchService.getBranchById.mockImplementation((id: number) =>
      Promise.resolve(id === 99 ? undefined : { id })
    );

    const result = await getCurrentBranchId();

    expect(result).toBe(5);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(99);
  });

  test('lanza BranchRemovedError cuando la sucursal resuelta fue eliminada', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 3, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    const error = await getCurrentBranchId().catch((e) => e);
    expect(error).toBeInstanceOf(BranchRemovedError);
    expect(error.code).toBe('BRANCH_REMOVED');
  });

  test('admin con cookie huérfana y sucursal propia eliminada recibe BranchRemovedError', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockCookie('99');
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    await expect(getCurrentBranchId()).rejects.toThrow(BranchRemovedError);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(99);
    expect(mockedBranchService.getBranchById).toHaveBeenCalledWith(5);
  });

  test('operador ignora la cookie de sucursal activa', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 3, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockCookie('9');
    mockedBranchService.getBranchById.mockResolvedValue({ id: 3 });

    const result = await getCurrentBranchId();

    expect(result).toBe(3);
    expect(mockedCookies).not.toHaveBeenCalled();
  });

  test('acepta un session pasado por parámetro sin llamar a auth', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 2, role: 'admin' },
    } as any;
    mockDbUserFromSession(session);
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
    mockedUserRepository.findByIdWithBranch.mockResolvedValue({
      id: 1,
      role: 'admin',
      branchId: null,
      branch: null,
    });

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
    mockDbUserFromSession(session);
    mockedBranchService.getBranchById.mockResolvedValue({ id: 1 });

    const result = await requireAdmin();

    expect(result).toBe(session);
  });

  test('lanza ForbiddenError cuando el usuario no es admin', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 1, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockedBranchService.getBranchById.mockResolvedValue({ id: 1 });

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
    await expect(requireAdmin()).rejects.toThrow(
      'Se requieren permisos de administrador.'
    );
  });

  test('usa el rol vigente en base aunque el JWT diga admin', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 1, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    // El rol fue degradado a operador después de emitir el JWT.
    mockedUserRepository.findByIdWithBranch.mockResolvedValue({
      id: 1,
      role: 'operator',
      branchId: 1,
      branch: { name: 'Sucursal' },
    });
    mockedBranchService.getBranchById.mockResolvedValue({ id: 1 });

    await expect(requireAdmin()).rejects.toThrow(ForbiddenError);
  });

  test('lanza BranchRemovedError cuando la sucursal del admin fue eliminada', async () => {
    const session = {
      user: { name: 'admin', id: '1', branchId: 5, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUserFromSession(session);
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    await expect(requireAdmin()).rejects.toThrow(BranchRemovedError);
    await expect(requireAdmin()).rejects.toThrow(
      'La sucursal asignada ya no existe.'
    );
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
    mockDbUserFromSession(session);
    mockRedirectThrow('');
    mockedBranchService.getBranchById.mockResolvedValue({ id: 3 });

    const result = await getCurrentBranchIdOrRedirect(session);

    expect(result).toBe(3);
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  test('redirige a /sesion-finalizada cuando el usuario ya no existe en base', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 3, role: 'operator' },
    } as any;
    mockedUserRepository.findByIdWithBranch.mockResolvedValue(undefined);
    mockRedirectThrow('/sesion-finalizada');

    await expect(getCurrentBranchIdOrRedirect(session)).rejects.toThrow(
      'NEXT_REDIRECT /sesion-finalizada'
    );

    expect(mockedRedirect).toHaveBeenCalledWith('/sesion-finalizada');
    expect(mockedBranchService.getBranchById).not.toHaveBeenCalled();
  });

  test('redirige a /sesion-finalizada cuando la sucursal de la sesión fue eliminada', async () => {
    const session = {
      user: { name: 'operator', id: '1', branchId: 3, role: 'operator' },
    } as any;
    mockDbUserFromSession(session);
    mockRedirectThrow('/sesion-finalizada');
    mockedBranchService.getBranchById.mockResolvedValue(undefined);

    await expect(getCurrentBranchIdOrRedirect(session)).rejects.toThrow(
      'NEXT_REDIRECT /sesion-finalizada'
    );

    expect(mockedRedirect).toHaveBeenCalledWith('/sesion-finalizada');
  });

  test('redirige a /sucursales cuando un admin no tiene sucursal', async () => {
    const session = {
      user: { name: 'admin', id: '1', role: 'admin' },
    } as any;
    mockedUserRepository.findByIdWithBranch.mockResolvedValue({
      id: 1,
      role: 'admin',
      branchId: null,
      branch: null,
    });
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
    mockedUserRepository.findByIdWithBranch.mockResolvedValue({
      id: 1,
      role: 'operator',
      branchId: null,
      branch: null,
    });
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
    mockDbUserFromSession(session);
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
