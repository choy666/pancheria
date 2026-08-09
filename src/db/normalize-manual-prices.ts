import { eq } from 'drizzle-orm';
import { db } from './index';
import { products } from './schema';

async function normalizeManualPrices() {
  const updated = await db
    .update(products)
    .set({ price: 0 })
    .where(eq(products.type, 'manual_supply'))
    .returning({ id: products.id, name: products.name });

  if (updated.length === 0) {
    console.log('No había insumos manuales con precio para normalizar.');
    return;
  }

  console.log(`Se normalizaron ${updated.length} insumo(s) manual(es):`);
  for (const product of updated) {
    console.log(`  - ${product.name} (id: ${product.id})`);
  }
}

async function main() {
  try {
    await normalizeManualPrices();
    process.exit(0);
  } catch (error) {
    console.error('Error al normalizar precios de insumos manuales:', error);
    process.exit(1);
  }
}

main();
