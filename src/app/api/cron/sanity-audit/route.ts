import * as sanityAuditService from '@/application/services/sanityAuditService';
import { withCronAuth } from '@/lib/cron-handler';

// Auditoría de solo lectura: recorre invariantes operativas (pendings
// vencidos sin barrer, cajas viejas, stock negativo/bajo, reservas
// huérfanas, pedidos pagados sin venta, ítems sin snapshot) y devuelve
// hallazgos con severidad. Lo invoca .github/workflows/sanity-audit.yml
// una vez por día; también acepta disparos manuales con el mismo Bearer.
export const maxDuration = 60;

export const GET = withCronAuth('cron/sanity-audit', async () =>
  sanityAuditService.runSanityAudit()
);
