import type { NextAuthConfig } from 'next-auth';
import { getAuthRedirect } from '@/lib/route-guard';

export const authConfig = {
  providers: [],
  secret: process.env.NEXTAUTH_SECRET,
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
