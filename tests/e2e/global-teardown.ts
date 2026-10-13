import { releaseE2ERunLock } from './run-lock';

/**
 * Libera el lock de corrida que tomó `global-setup.ts` sobre la base de datos
 * compartida (ver tests/e2e/run-lock.ts). Corre en el mismo proceso del
 * runner al final de la suite; si la corrida muere sin teardown, el lock
 * expira solo según E2E_RUN_LOCK_STALE_MINUTES.
 */
export default async function globalTeardown(): Promise<void> {
  await releaseE2ERunLock();
}
