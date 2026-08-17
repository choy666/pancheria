import { NextResponse } from 'next/server';
import { getAuthRedirect, isPublicPath } from './route-guard';
import { routes } from '@/config/routes';

const ORIGIN = 'http://localhost:3000';

describe('isPublicPath', () => {
  test('/pedido es público', () => {
    expect(isPublicPath(routes.pedido)).toBe(true);
  });

  test('/login es público', () => {
    expect(isPublicPath(routes.login)).toBe(true);
  });

  test('rutas de /api/public son públicas', () => {
    expect(isPublicPath('/api/public/pedido')).toBe(true);
    expect(isPublicPath('/api/public/catalogo')).toBe(true);
  });

  test('recursos estáticos son públicos', () => {
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true);
    expect(isPublicPath('/_next/image?url=...')).toBe(true);
    expect(isPublicPath('/favicon.ico')).toBe(true);
  });

  test('rutas del panel no son públicas', () => {
    expect(isPublicPath(routes.home)).toBe(false);
    expect(isPublicPath(routes.ventas)).toBe(false);
    expect(isPublicPath(routes.pedidos)).toBe(false);
  });
});

describe('getAuthRedirect', () => {
  test('permite /pedido sin sesión', () => {
    const redirect = getAuthRedirect(false, routes.pedido, ORIGIN);
    expect(redirect).toBeNull();
  });

  test('permite /login sin sesión', () => {
    const redirect = getAuthRedirect(false, routes.login, ORIGIN);
    expect(redirect).toBeNull();
  });

  test('redirige / a /pedido cuando no hay sesión', () => {
    const redirect = getAuthRedirect(false, routes.home, ORIGIN);
    expect(redirect).toBeInstanceOf(NextResponse);
    expect(redirect?.headers.get('location')).toBe(`${ORIGIN}${routes.pedido}`);
  });

  test('redirige /login a / cuando ya hay sesión', () => {
    const redirect = getAuthRedirect(true, routes.login, ORIGIN);
    expect(redirect).toBeInstanceOf(NextResponse);
    expect(redirect?.headers.get('location')).toBe(`${ORIGIN}${routes.home}`);
  });

  test('redirige rutas protegidas a /login cuando no hay sesión', () => {
    const redirect = getAuthRedirect(false, routes.ventas, ORIGIN);
    expect(redirect).toBeInstanceOf(NextResponse);
    expect(redirect?.headers.get('location')).toBe(`${ORIGIN}${routes.login}`);
  });

  test('permite rutas protegidas con sesión', () => {
    const redirect = getAuthRedirect(true, routes.ventas, ORIGIN);
    expect(redirect).toBeNull();
  });
});
