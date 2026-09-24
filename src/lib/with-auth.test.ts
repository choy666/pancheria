import { NextRequest } from 'next/server';
import { withAuth } from './with-auth';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import * as branchService from '@/application/services/branchService';
import * as userRepository from '@/repositories/userRepository';
import { UnauthorizedError, ForbiddenError } from '@/domain/errors';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@/application/services/branchService', () => ({
  getBranchById: jest.fn(),
}));

jest.mock('@/repositories/userRepository', () => ({
  findByIdWithBranch: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockedAuth = auth as unknown as jest.Mock;
const mockedCookies = cookies as unknown as jest.Mock;
const mockedGetBranchById = branchService.getBranchById as unknown as jest.Mock;
const mockedFindByIdWithBranch =
  userRepository.findByIdWithBranch as unknown as jest.Mock;

// Replicamos el usuario vigente en DB que revalidateSessionUser consulta en
// cada request: los valores coinciden con la sesión mock para no alterar las
// aserciones existentes.
function mockDbUser(user: { id: string; branchId: number; role: string }) {
  mockedFindByIdWithBranch.mockResolvedValue({
    id: Number(user.id),
    branchId: user.branchId,
    role: user.role,
    branch: { id: user.branchId, name: 'Sucursal' },
  });
}

function mockCookie(value?: string) {
  mockedCookies.mockResolvedValue({
    get: jest.fn().mockReturnValue(value ? { value } : undefined),
  });
}

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/test', {
    headers: { 'x-branch-id': '99' },
  });
}

describe('withAuth', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('admin con cookie de sucursal válida recibe el branchId de la cookie', async () => {
    const session = {
      user: { id: '1', name: 'admin', branchId: 1, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUser(session.user);
    mockCookie('2');
    mockedGetBranchById.mockResolvedValue({ id: 2, name: 'Sucursal 2' });

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = createRequest();
    const context = { params: Promise.resolve({ id: '123' }) };

    const response = await wrapped(request, context);

    expect(response.status).toBe(200);
    expect(mockedGetBranchById).toHaveBeenCalledWith(2);
    expect(handler).toHaveBeenCalledWith(request, context, {
      session,
      branchId: 2,
    });
  });

  test('operator ignora la cookie y recibe el branchId de la sesión', async () => {
    const session = {
      user: { id: '2', name: 'operator', branchId: 3, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUser(session.user);
    mockCookie('2');
    mockedGetBranchById.mockResolvedValue({ id: 3, name: 'Sucursal 3' });

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = createRequest();
    const context = { params: Promise.resolve({ id: '456' }) };

    const response = await wrapped(request, context);

    expect(response.status).toBe(200);
    expect(mockedCookies).not.toHaveBeenCalled();
    // La sucursal de sesión sí se consulta para validar que existe (E4).
    expect(mockedGetBranchById).toHaveBeenCalledWith(3);
    expect(handler).toHaveBeenCalledWith(request, context, {
      session,
      branchId: 3,
    });
  });

  test('admin con cookie inválida recibe el branchId de la sesión', async () => {
    const session = {
      user: { id: '1', name: 'admin', branchId: 1, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUser(session.user);
    mockCookie('abc');
    mockedGetBranchById.mockResolvedValue({ id: 1, name: 'Sucursal 1' });

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = createRequest();
    const context = { params: Promise.resolve({}) };

    await wrapped(request, context);

    // Solo se consulta la sucursal de sesión (la cookie inválida se ignora).
    expect(mockedGetBranchById).toHaveBeenCalledWith(1);
    expect(mockedGetBranchById).not.toHaveBeenCalledWith(99);
    expect(handler).toHaveBeenCalledWith(request, context, {
      session,
      branchId: 1,
    });
  });

  test('admin con cookie de sucursal inexistente recibe el branchId de la sesión', async () => {
    const session = {
      user: { id: '1', name: 'admin', branchId: 1, role: 'admin' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUser(session.user);
    mockCookie('99');
    mockedGetBranchById.mockImplementation((id: number) =>
      Promise.resolve(id === 99 ? undefined : { id, name: `Sucursal ${id}` })
    );

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = createRequest();
    const context = { params: Promise.resolve({}) };

    await wrapped(request, context);

    expect(mockedGetBranchById).toHaveBeenCalledWith(99);
    expect(handler).toHaveBeenCalledWith(request, context, {
      session,
      branchId: 1,
    });
  });

  test('con opción admin requiere rol administrador', async () => {
    const session = {
      user: { id: '2', name: 'operator', branchId: 3, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUser(session.user);
    mockedGetBranchById.mockResolvedValue({ id: 3, name: 'Sucursal 3' });

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler, { admin: true });
    const request = createRequest();
    const context = { params: Promise.resolve({}) };

    await expect(wrapped(request, context)).rejects.toThrow(ForbiddenError);
    expect(handler).not.toHaveBeenCalled();
  });

  test('sin sesión devuelve UnauthorizedError', async () => {
    mockedAuth.mockResolvedValue(null);

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = createRequest();
    const context = { params: Promise.resolve({}) };

    await expect(wrapped(request, context)).rejects.toThrow(UnauthorizedError);
    expect(handler).not.toHaveBeenCalled();
  });

  test('el header x-branch-id no altera el branchId resuelto por la sesión', async () => {
    const session = {
      user: { id: '2', name: 'operator', branchId: 5, role: 'operator' },
    } as any;
    mockedAuth.mockResolvedValue(session);
    mockDbUser(session.user);
    mockedGetBranchById.mockResolvedValue({ id: 5, name: 'Sucursal 5' });

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: { 'x-branch-id': '99' },
    });
    const context = { params: Promise.resolve({}) };

    await wrapped(request, context);

    expect(handler).toHaveBeenCalledWith(request, context, {
      session,
      branchId: 5,
    });
  });
});
