import { NextRequest } from 'next/server';
import { withAuth } from './with-auth';
import { auth } from '@/auth';
import { cookies } from 'next/headers';
import * as branchService from '@/application/services/branchService';
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
    mockCookie('2');

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = createRequest();
    const context = { params: Promise.resolve({ id: '456' }) };

    const response = await wrapped(request, context);

    expect(response.status).toBe(200);
    expect(mockedCookies).not.toHaveBeenCalled();
    expect(mockedGetBranchById).not.toHaveBeenCalled();
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
    mockCookie('abc');

    const handler = jest.fn().mockResolvedValue(new Response('ok'));
    const wrapped = withAuth(handler);
    const request = createRequest();
    const context = { params: Promise.resolve({}) };

    await wrapped(request, context);

    expect(mockedGetBranchById).not.toHaveBeenCalled();
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
    mockCookie('99');
    mockedGetBranchById.mockResolvedValue(undefined);

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
