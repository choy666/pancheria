import * as orderService from '@/application/services/orderService';
import { withCronAuth } from '@/lib/cron-handler';

// Plan Hobby con Fluid Compute permite hasta 300 s por función
// (verificado en producción 2026-09-19, Fase M del plan de escalabilidad).
export const maxDuration = 300;

export const GET = withCronAuth('cron/expire-orders', async () => {
  const expired = await orderService.expirePendingOrders();
  return { expired };
});
