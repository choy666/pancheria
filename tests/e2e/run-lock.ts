import os from 'os';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db';

/**
 * Lock de corrida E2E sobre la base de datos compartida.
 *
 * `global-setup.ts` trunca y re-siembra todas las tablas: si dos corridas de
 * Playwright apuntan a la misma base (CI + `npm run test:e2e` local, el
 * test-server del IDE, otra máquina de desarrollo), la segunda borra el estado
 * de la primera a mitad de camino y produce fallas confusas ("Sucursal con ID
 * N no encontrado", redirects a /login?error=branch_removed, lookups por
 * nombre que no encuentran la sucursal del seed de la otra corrida).
 *
 * El grupo de concurrencia `e2e-db-*` del workflow solo serializa jobs de CI
 * entre sí; no ve procesos fuera de GitHub Actions. Este lock vive en la
 * propia base (tabla `e2e_run_lock`, de una sola fila), así que cubre cualquier
 * origen de corrida. Se libera en `global-teardown.ts`; si una corrida muere
 * sin teardown, el lock expira solo pasados RUN_LOCK_STALE_MINUTES.
 *
 * La tabla es infraestructura de tests, no schema de la app: se crea con
 * `CREATE TABLE IF NOT EXISTS` acá y queda fuera del schema de drizzle a
 * propósito (un `drizzle-kit push` podría querer borrar tablas ajenas, pero
 * esta base es descartable y el create es idempotente).
 */

const LOCK_ROW_ID = 1;
const DEFAULT_WAIT_MINUTES = 30;
const DEFAULT_STALE_MINUTES = 45;
const DEFAULT_POLL_MS = 15_000;

/** Identificador legible de la corrida que toma el lock, para diagnóstico. */
function getE2ERunLockId(): string {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  const attempt = process.env.GITHUB_RUN_ATTEMPT;
  if (repo && runId) {
    return `ci:${repo}/actions/runs/${runId}${attempt ? `/attempts/${attempt}` : ''}`;
  }
  return `local:${os.hostname()}:pid-${process.pid}:${Date.now().toString(36)}`;
}

interface ExecuteResult {
  rows?: unknown[];
}

function rowsOf(result: unknown): Record<string, unknown>[] {
  const r = result as ExecuteResult | unknown[];
  if (Array.isArray(r)) return r as Record<string, unknown>[];
  return (r.rows ?? []) as Record<string, unknown>[];
}

function envMinutes(key: string, fallback: number): number {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureLockTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS e2e_run_lock (
      id smallint PRIMARY KEY,
      run_id text NOT NULL,
      started_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Toma el lock de corrida. Si otra corrida lo tiene, espera con reintentos
 * hasta `E2E_RUN_LOCK_WAIT_MINUTES` (default 30); si el lock supera
 * `E2E_RUN_LOCK_STALE_MINUTES` (default 45) se considera de una corrida muerta
 * y se toma igual. `E2E_IGNORE_RUN_LOCK=1` lo omite por completo (peligroso:
 * solo para diagnóstico sabiendo que nadie más usa la base).
 */
export async function acquireE2ERunLock(options?: {
  waitMinutes?: number;
  pollMs?: number;
}): Promise<void> {
  if (process.env.E2E_IGNORE_RUN_LOCK === '1') {
    console.warn(
      '[E2E] E2E_IGNORE_RUN_LOCK=1: se omite el lock de corrida. Solo válido si ninguna otra corrida usa esta base.'
    );
    return;
  }

  const runId = getE2ERunLockId();
  const waitMinutes =
    options?.waitMinutes ?? envMinutes('E2E_RUN_LOCK_WAIT_MINUTES', DEFAULT_WAIT_MINUTES);
  const staleMinutes = envMinutes('E2E_RUN_LOCK_STALE_MINUTES', DEFAULT_STALE_MINUTES);
  const pollMs = options?.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + waitMinutes * 60_000;

  await ensureLockTable();

  for (;;) {
    // Una corrida que murió sin teardown deja el lock tomado: pasado el
    // umbral de staleness se libera para que la siguiente pueda continuar.
    await db.execute(sql`
      DELETE FROM e2e_run_lock
      WHERE id = ${LOCK_ROW_ID}
        AND started_at < now() - make_interval(mins => ${staleMinutes})
    `);

    const inserted = rowsOf(
      await db.execute(sql`
        INSERT INTO e2e_run_lock (id, run_id)
        VALUES (${LOCK_ROW_ID}, ${runId})
        ON CONFLICT (id) DO NOTHING
        RETURNING run_id
      `)
    );

    if (inserted.length > 0) {
      process.env.E2E_RUN_LOCK_ID = runId;
      console.log(`[E2E] Lock de corrida adquirido: ${runId}`);
      return;
    }

    const holders = rowsOf(
      await db.execute(
        sql`SELECT run_id, started_at FROM e2e_run_lock WHERE id = ${LOCK_ROW_ID}`
      )
    );
    const holder = holders[0];

    if (Date.now() >= deadline) {
      throw new Error(
        `La base de E2E está en uso por otra corrida: ${holder?.run_id ?? 'desconocida'} ` +
          `(iniciada ${holder?.started_at ?? 'desconocido'}). ` +
          `Esperá a que termine; si la corrida murió sin liberar, el lock expira a los ` +
          `${staleMinutes} minutos o podés borrar la fila de e2e_run_lock. ` +
          `Como último recurso: E2E_IGNORE_RUN_LOCK=1.`
      );
    }

    console.log(
      `[E2E] Base en uso por ${holder?.run_id ?? 'otra corrida'}; reintentando en ${Math.round(
        pollMs / 1000
      )}s…`
    );
    await sleep(pollMs);
  }
}

/**
 * Libera el lock si esta corrida lo tiene. Solo borra la fila cuyo run_id
 * coincide con el adquirido: nunca toca el lock de otra corrida.
 */
export async function releaseE2ERunLock(): Promise<void> {
  const runId = process.env.E2E_RUN_LOCK_ID;
  if (!runId || process.env.E2E_IGNORE_RUN_LOCK === '1') {
    return;
  }

  try {
    await db.execute(
      sql`DELETE FROM e2e_run_lock WHERE id = ${LOCK_ROW_ID} AND run_id = ${runId}`
    );
    delete process.env.E2E_RUN_LOCK_ID;
    console.log(`[E2E] Lock de corrida liberado: ${runId}`);
  } catch (error) {
    // Un fallo al liberar no debe romper la corrida: el lock expira solo.
    console.warn('[E2E] No se pudo liberar el lock de corrida (expira solo):', error);
  }
}
