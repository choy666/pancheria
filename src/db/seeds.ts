import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from './index';
import { products, recipes, users } from './schema';

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn('ADMIN_USERNAME o ADMIN_PASSWORD no están definidos. Se omite el seed de administrador.');
    return;
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    console.log('El usuario administrador ya existe.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    username,
    passwordHash,
  });

  console.log('Usuario administrador creado.');
}

async function seedSampleData() {
  const existingProducts = await db.query.products.findMany({
    columns: { id: true },
    limit: 1,
  });

  if (existingProducts.length > 0) {
    console.log('Ya existen productos. Se omite el seed de datos de ejemplo.');
    return;
  }

  const seededProducts = await db
    .insert(products)
    .values([
      {
        name: 'Pan de panchuque',
        type: 'critical_supply',
        criticalSupplyType: 'bread',
        price: 0,
        unit: 'unidad',
        stock: 100,
        minStock: 20,
        isActive: true,
      },
      {
        name: 'Salchicha',
        type: 'critical_supply',
        criticalSupplyType: 'sausage',
        price: 0,
        unit: 'unidad',
        stock: 100,
        minStock: 20,
        isActive: true,
      },
      {
        name: 'Gaseosa 500ml',
        type: 'critical_supply',
        criticalSupplyType: 'beverage',
        price: 500.00,
        unit: 'unidad',
        stock: 50,
        minStock: 10,
        isActive: true,
      },
      {
        name: 'Ketchup',
        type: 'manual_supply',
        price: 0,
        unit: 'envase',
        stock: 10,
        minStock: 2,
        isActive: true,
      },
      {
        name: 'Servilleta',
        type: 'manual_supply',
        price: 0,
        unit: 'unidad',
        stock: 500,
        minStock: 100,
        isActive: true,
      },
      {
        name: 'Panchuque completo',
        type: 'compound',
        price: 1500.00,
        unit: 'unidad',
        stock: 0,
        minStock: 0,
        isActive: true,
      },
    ])
    .returning({ id: products.id, name: products.name });

  const findProduct = (name: string) =>
    seededProducts.find((p) => p.name === name);

  const bread = findProduct('Pan de panchuque');
  const sausage = findProduct('Salchicha');
  const beverage = findProduct('Gaseosa 500ml');
  const ketchup = findProduct('Ketchup');
  const napkin = findProduct('Servilleta');
  const compoundProduct = findProduct('Panchuque completo');

  if (!bread || !sausage || !beverage || !ketchup || !napkin || !compoundProduct) {
    console.error('No se pudo crear alguno de los productos de ejemplo.');
    return;
  }

  await db.insert(recipes).values([
    {
      compoundProductId: compoundProduct.id,
      supplyId: bread.id,
      quantity: 1,
      autoDiscount: true,
    },
    {
      compoundProductId: compoundProduct.id,
      supplyId: sausage.id,
      quantity: 1,
      autoDiscount: true,
    },
    {
      compoundProductId: compoundProduct.id,
      supplyId: ketchup.id,
      quantity: 1,
      autoDiscount: false,
    },
    {
      compoundProductId: compoundProduct.id,
      supplyId: napkin.id,
      quantity: 1,
      autoDiscount: false,
    },
  ]);

  console.log('Datos de ejemplo creados.');
}

async function main() {
  try {
    await seedAdmin();
    await seedSampleData();
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar el seed:', error);
    process.exit(1);
  }
}

main();
