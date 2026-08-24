import type { NextAuthConfig } from 'next-auth';
import { getAuthRedirect } from '@/lib/route-guard';

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      'Falta el secreto de autenticación. Definí AUTH_SECRET o NEXTAUTH_SECRET en las variables de entorno. ' +
        'En CI debe estar configurado como repository secret; en local, agregalo en .env.local o .env.e2e.'
    );
  }

  const byteLength = new TextEncoder().encode(secret).length;
  if (byteLength < 32) {
    throw new Error(
      `El secreto de autenticación debe tener al menos 32 bytes (tenía ${byteLength}). ` +
        'Generalo con "npx auth secret" o "openssl rand -base64 32".'
    );
  }

  return secret;
}

export const authConfig = {
  providers: [],
  secret: getAuthSecret(),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const redirect = getAuthRedirect(
        isLoggedIn,
        nextUrl.pathname,
        nextUrl.origin
      );

      return redirect ?? true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.branchId = user.branchId;
        token.branchName = user.branchName;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      if (token?.role) {
        session.user.role = token.role as string;
      }
      if (token?.branchId) {
        session.user.branchId = token.branchId as number;
      }
      if (token?.branchName) {
        session.user.branchName = token.branchName as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
