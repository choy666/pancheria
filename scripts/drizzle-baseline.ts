import dotenv from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Carga `.env.local` por defecto; con TARGET_E2E=1 pisa con `.env.e2e`.
// El baseline puede apuntarse a cualquier base exportando las variables
// DATABASE_URL_UNPOOLED / DATABASE_URL (o los aliases de Vercel Postgres)
// antes de ejecutar el script.
dotenv.config({ path: '.env.local' });
if (process.env.TARGET_E2E === '1') {
  dotenv.config({ path: '.env.e2e', override: true });
}

import { Client } from 'pg';
import { getDatabaseUrl, getDatabaseUrlUnpooled } from '../src/config/database';

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  entries: JournalEntry[];
}

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle');
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta', '_journal.json');

function readEntries(): JournalEntry[] {
  const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as Journal;
  return [...journal.entries].sort((a, b) => a.when - b.when);
}

function migrationHash(tag: string): string {
  const content = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8');
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  const throughArg = process.argv.find((arg) => arg.startsWith('--through='));
  const throughPrefix = throughArg?.split('=')[1];

  const url = getDatabaseUrlUnpooled() ?? getDatabaseUrl();
  if (!url) {
    console.error(
      'No se encontró una URL de conexión. Definí DATABASE_URL_UNPOOLED, ' +
        'DATABASE_URL o los aliases de Vercel Postgres.'
    );
    process.exit(1);
  }

  const entries = readEntries();
  const toBaseline = throughPrefix
    ? entries.filter((entry) => entry.tag.split('_')[0] <= throughPrefix)
    : entries;

  if (toBaseline.length === 0) {
    console.error(`No se encontraron migraciones para baselinar hasta "${throughPrefix}".`);
    process.exit(1);
  }

  const target = process.env.TARGET_E2E === '1' ? 'E2E' : 'DEV/actual';
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // Mismo DDL que usa drizzle-orm/pg-core al ejecutar `migrate`.
    await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`
    );

    const existing = await client.query<{ created_at: string }>(
      `SELECT created_at FROM "drizzle"."__drizzle_migrations"`
    );
    const recorded = new Set(existing.rows.map((row) => Number(row.created_at)));

    await client.query('BEGIN');
    let inserted = 0;
    for (const entry of toBaseline) {
      if (recorded.has(entry.when)) {
        continue;
      }
      await client.query(
        `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
        [migrationHash(entry.tag), entry.when]
      );
      console.log(`[${target}] baseline: ${entry.tag}`);
      inserted += 1;
    }
    await client.query('COMMIT');

    console.log(
      `[${target}] Baseline listo: ${inserted} filas insertadas, ${toBaseline.length} migraciones cubiertas.`
    );
    if (throughPrefix) {
      const pending = entries.filter((entry) => entry.tag.split('_')[0] > throughPrefix);
      console.log(
        `Migraciones que quedarán pendientes para \`drizzle-kit migrate\`: ${pending
          .map((entry) => entry.tag)
          .join(', ') || 'ninguna'}`
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error al crear el baseline:', err instanceof Error ? err.message : err);
  process.exit(1);
});
