import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { requireAuth, requireAdmin, getCurrentBranchId } from '@/lib/auth';

export interface AuthContext {
  session: Session;
  branchId: number;
}

export function withAuth<TParams extends Record<string, string>>(
  handler: (
    request: NextRequest,
    context: { params: Promise<TParams> },
    auth: AuthContext
  ) => Promise<Response>,
  options?: { admin?: boolean }
) {
  return async (
    request: NextRequest,
    context: { params: Promise<TParams> }
  ): Promise<Response> => {
    const session = options?.admin
      ? await requireAdmin()
      : await requireAuth();
    const branchId = await getCurrentBranchId(session);
    return handler(request, context, { session, branchId });
  };
}
