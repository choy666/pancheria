import { NextResponse } from 'next/server';
import { routes } from '@/config/routes';

const PUBLIC_PATHS: Set<string> = new Set([routes.pedido, routes.login]);

const PUBLIC_PREFIXES = [
  '/api/public',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
];

const PUBLIC_FILE_EXTENSIONS = new Set(['.svg', '.png', '.ico', '.jpg', '.jpeg']);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return true;
    }
  }

  const ext = pathname.slice(pathname.lastIndexOf('.'));
  if (PUBLIC_FILE_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

export function getAuthRedirect(
  isLoggedIn: boolean,
  pathname: string,
  origin: string
): NextResponse | null {
  if (pathname === routes.login) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(routes.home, origin));
    }
    return null;
  }

  if (pathname === routes.home && !isLoggedIn) {
    // La raíz apunta al catálogo público para usuarios no autenticados.
    // Las demás rutas protegidas redirigen a /login.
    return NextResponse.redirect(new URL(routes.pedido, origin));
  }

  if (isPublicPath(pathname)) {
    return null;
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL(routes.login, origin));
  }

  return null;
}
