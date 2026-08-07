import { db } from '../../src/db';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';

export default async function globalSetup() {
  if (process.env.NO_GLOBAL_SETUP) {
    return;
  }

  await db.execute(sql`
    TRUNCATE TABLE
      products,
      recipes,
      sales,
      sale_items,
      stock_movements,
      cash_registers,
      daily_closures
    RESTART IDENTITY CASCADE;
  `);

  execSync('npx tsx src/db/seeds.ts', { cwd: process.cwd(), stdio: 'inherit' });
}
