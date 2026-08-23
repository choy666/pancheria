import { auth } from '@/auth';

export const proxy = auth;

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|pedido|.*\\.svg$).*)',
  ],
};
