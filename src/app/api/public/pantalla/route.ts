import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiErrorHandling } from '@/lib/api-handler';
import {
  resolvePublicBranchId,
  DEFAULT_BRANCH_ERROR,
} from '@/lib/branch-resolver';
import { buildCdnCacheControlHeaders } from '@/lib/cache-control';
import {
  getPublicCatalogCacheSMaxage,
  getPublicCatalogCacheSwr,
} from '@/config/catalog';
import { buildPantallaSnapshot } from '@/lib/pantalla-snapshot';

const querySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

export const dynamic = 'force-dynamic';

/**
 * Snapshot único para la pantalla publicitaria `/pantalla`: sucursal con su
 * estado operativo, catálogo con disponibilidad y playlist de videos
 * activos. La TV lo consulta periódicamente sin depender de auth.
 * Sucursal inexistente o inactiva: `resolvePublicBranchId` devuelve `null`
 * y se responde 400 sin alcanzar el snapshot (además de la 400 de
 * validación Zod para un `branchId` malformado).
 */
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));
  const branchId = await resolvePublicBranchId(query.branchId ?? null);

  if (!branchId) {
    return NextResponse.json({ error: DEFAULT_BRANCH_ERROR }, { status: 400 });
  }

  const snapshot = await buildPantallaSnapshot(branchId);

  return NextResponse.json(snapshot, {
    headers: buildCdnCacheControlHeaders(
      getPublicCatalogCacheSMaxage(),
      getPublicCatalogCacheSwr()
    ),
  });
}, 'GET /api/public/pantalla');
