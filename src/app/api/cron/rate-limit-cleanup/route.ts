import { getLoginAttemptsRetentionMs } from '@/config/rate-limit';
import { DbPublicOrderRateLimitStore } from '@/lib/public-order-rate-limit-store';
import { getRateLimitStore } from '@/lib/rate-limit-store';
import { withCronAuth } from '@/lib/cron-handler';

// Plan Hobby con Fluid Compute permite hasta 300 s por función
// (verificado en producción 2026-09-19, Fase M del plan de escalabilidad).
export const maxDuration = 300;

export const GET = withCronAuth('cron/rate-limit-cleanup', async () => {
  const store = new DbPublicOrderRateLimitStore();
  const deletedRateLimits = await store.cleanupExpired();
  const deletedLoginAttempts = await getRateLimitStore().cleanupStale(
    getLoginAttemptsRetentionMs()
  );

  return { deletedRateLimits, deletedLoginAttempts };
});
