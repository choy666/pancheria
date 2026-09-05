import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';
import { getCspHeader } from '@/lib/csp-helpers';

/**
 * Proxy/middleware de NextAuth v5 con CSP basado en nonce.
 *
 * El nonce se genera por request y se propaga a los componentes de servidor
 * mediante el header `x-nonce`. Esto permite eliminar `unsafe-inline` y
 * `unsafe-eval` de `script-src` sin romper los scripts inyectados por Next.js.
 */
export const proxy = auth((req: NextAuthRequest) => {
  const nonce = crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', getCspHeader(nonce));

  return response;
});

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
