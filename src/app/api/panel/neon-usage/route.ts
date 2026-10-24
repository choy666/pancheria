import { NextResponse } from 'next/server';
import { getNeonUsage } from '@/application/services/neonUsageService';
import { withApiErrorHandling } from '@/lib/api-handler';
import { withAuth } from '@/lib/with-auth';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(
  withAuth(async () => {
    const usage = await getNeonUsage();
    return NextResponse.json(usage);
  }, { admin: true }),
  'GET /api/panel/neon-usage'
);

export const runtime = 'nodejs';
