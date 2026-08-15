import { db } from '../../src/db';
import { sql } from 'drizzle-orm';
import { execSync } from 'child_process';
import { setupSecondBranchForE2E } from './helpers';

export default async function globalSetup() {
  if (process.env.NO_GLOBAL_SETUP) {
    return;
  }

  await db.execute(sql`
    TRUNCATE TABLE
      sale_items,
      order_items,
      stock_movements,
      sales,
      orders,
      recipes,
      products,
      videos,
      cash_registers,
      daily_closures,
      users,
      branches
    RESTART IDENTITY CASCADE;
  `);

  execSync('npx tsx src/db/seeds.ts', { cwd: process.cwd(), stdio: 'inherit' });

  // Si el seed no creó una segunda sucursal, la creamos aquí para los tests
  // de cambio de sucursal y aislamiento de datos.
  if (!process.env.NEW_BRANCH_NAME) {
    try {
      const second = await setupSecondBranchForE2E();
      console.log(`Sucursal de E2E creada: ${second.branchName} (id: ${second.branchId})`);
      console.log(`Operador de E2E: ${second.username}`);
    } catch (error) {
      console.error('Error creando la sucursal/operador de prueba:', error);
      throw error;
    }
  }
}
