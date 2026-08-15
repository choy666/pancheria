import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from './index';
import { products, recipes, users, branches } from './schema';
import * as stockService from '@/application/services/stockService';

const DEFAULT_BRANCH_NAME = process.env.DEFAULT_BRANCH_NAME ?? 'Sucursal por defecto';
const NEW_BRANCH_NAME = process.env.NEW_BRANCH_NAME;
const NEW_BRANCH_USERNAME = process.env.NEW_BRANCH_USERNAME;
const NEW_BRANCH_PASSWORD = process.env.NEW_BRANCH_PASSWORD;

async function seedDefaultBranch(): Promise<number> {
  const existing = await db.query.branches.findFirst({
    where: eq(branches.name, DEFAULT_BRANCH_NAME),
  });

  if (existing) {
    console.log('La sucursal por defecto ya existe.');
    return existing.id;
  }

  const [branch] = await db
    .insert(branches)
    .values({ name: DEFAULT_BRANCH_NAME })
    .returning({ id: branches.id });

  console.log('Sucursal por defecto creada.');
  return branch.id;
}

async function seedAdmin(defaultBranchId: number) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn(
      'ADMIN_USERNAME o ADMIN_PASSWORD no están definidos. Se omite el seed de administrador.'
    );
    return;
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (existing) {
    if (!existing.branchId) {
      await db
        .update(users)
        .set({ branchId: defaultBranchId })
        .where(eq(users.id, existing.id));
      console.log(
        'El usuario administrador existía sin sucursal; se le asignó la sucursal por defecto.'
      );
      return;
    }

    console.log('El usuario administrador ya existe.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    username,
    passwordHash,
    role: 'admin',
    branchId: defaultBranchId,
  });

  console.log('Usuario administrador creado.');
}

async function seedOptionalBranch() {
  if (!NEW_BRANCH_NAME || !NEW_BRANCH_USERNAME || !NEW_BRANCH_PASSWORD) {
    return;
  }

  const existingBranch = await db.query.branches.findFirst({
    where: eq(branches.name, NEW_BRANCH_NAME),
  });

  if (existingBranch) {
    console.log('La sucursal opcional ya existe.');
    return;
  }

  const [branch] = await db
    .insert(branches)
    .values({ name: NEW_BRANCH_NAME })
    .returning({ id: branches.id });

  const existingUser = await db.query.users.findFirst({
    where: eq(users.username, NEW_BRANCH_USERNAME),
  });

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(NEW_BRANCH_PASSWORD, 10);
    await db.insert(users).values({
      username: NEW_BRANCH_USERNAME,
      passwordHash,
      role: 'operator',
      branchId: branch.id,
    });
    console.log('Usuario de la sucursal opcional creado.');
  }

  console.log('Sucursal opcional creada.');
}

type SeedProduct = {
  name: string;
  type: 'critical_supply' | 'compound' | 'manual_supply' | 'service';
  criticalSupplyType?: 'bread' | 'sausage' | 'beverage' | null;
  price: number;
  unit: string;
  stock: number;
  minStock: number;
};

const baseProducts: SeedProduct[] = [
  { name: 'Pan', type: 'critical_supply', criticalSupplyType: 'bread', price: 0, unit: 'unidad', stock: 32, minStock: 5 },
  { name: 'Salchichas', type: 'critical_supply', criticalSupplyType: 'sausage', price: 0, unit: 'unidad', stock: 10, minStock: 5 },
  { name: 'Gas', type: 'manual_supply', price: 0, unit: 'unidad', stock: 2, minStock: 0 },
  { name: 'Caja chica', type: 'manual_supply', price: 0, unit: 'caja', stock: 4, minStock: 0 },
  { name: 'Porta super', type: 'manual_supply', price: 0, unit: 'unidad', stock: 2, minStock: 0 },
  { name: 'Sorbetes', type: 'manual_supply', price: 0, unit: 'unidad', stock: 4, minStock: 0 },
  { name: 'Folex', type: 'manual_supply', price: 0, unit: 'rollo', stock: 4, minStock: 0 },
  { name: 'Bolsas camisetas', type: 'manual_supply', price: 0, unit: 'paquete', stock: 4, minStock: 0 },
  { name: 'Mayonesa', type: 'manual_supply', price: 0, unit: 'envase', stock: 0, minStock: 0 },
  { name: 'Ketchup', type: 'manual_supply', price: 0, unit: 'envase', stock: 2, minStock: 0 },
  { name: 'Mostaza', type: 'manual_supply', price: 0, unit: 'envase', stock: 5, minStock: 0 },
  { name: 'Salsa golf', type: 'manual_supply', price: 0, unit: 'envase', stock: 1, minStock: 0 },
  { name: 'Cheddar', type: 'manual_supply', price: 0, unit: 'porción', stock: 2, minStock: 0 },
  { name: 'Parmesano', type: 'manual_supply', price: 0, unit: 'porción', stock: 7, minStock: 0 },
  { name: 'Fugazeta', type: 'manual_supply', price: 0, unit: 'porción', stock: 3, minStock: 0 },
  { name: 'Aceituna', type: 'manual_supply', price: 0, unit: 'porción', stock: 1, minStock: 0 },
  { name: 'Salame', type: 'manual_supply', price: 0, unit: 'porción', stock: 6, minStock: 0 },
  { name: 'Roquefort', type: 'manual_supply', price: 0, unit: 'porción', stock: 2, minStock: 0 },
  { name: 'Barbacoa', type: 'manual_supply', price: 0, unit: 'envase', stock: 6, minStock: 0 },
  { name: 'Chimichurri', type: 'manual_supply', price: 0, unit: 'envase', stock: 3, minStock: 0 },
  { name: 'Picante', type: 'manual_supply', price: 0, unit: 'envase', stock: 2, minStock: 0 },
  { name: 'Choclo grano', type: 'manual_supply', price: 0, unit: 'porción', stock: 7, minStock: 0 },
  { name: 'Choclo crema', type: 'manual_supply', price: 0, unit: 'porción', stock: 0, minStock: 0 },
  { name: 'Choclo arveja', type: 'manual_supply', price: 0, unit: 'porción', stock: 0, minStock: 0 },
  { name: 'Huevos', type: 'manual_supply', price: 0, unit: 'unidad', stock: 4, minStock: 0 },
  { name: 'Tomates', type: 'manual_supply', price: 0, unit: 'unidad', stock: 4, minStock: 0 },
  { name: 'Morrones', type: 'manual_supply', price: 0, unit: 'unidad', stock: 2, minStock: 0 },
  { name: 'Cebollas', type: 'manual_supply', price: 0, unit: 'unidad', stock: 2, minStock: 0 },
  { name: 'Provenzal', type: 'manual_supply', price: 0, unit: 'porción', stock: 4, minStock: 0 },
  { name: 'Ajo', type: 'manual_supply', price: 0, unit: 'unidad', stock: 4, minStock: 0 },
  { name: 'Papas pay', type: 'manual_supply', price: 0, unit: 'porción', stock: 0, minStock: 0 },
  { name: 'Coca de 1L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 10, minStock: 2 },
  { name: 'Coca de 1,5L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 8, minStock: 2 },
  { name: 'Coca de 350cc', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 0, minStock: 2 },
  { name: 'Pritty 500cc', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 0, minStock: 2 },
  { name: 'Doble Cola 2,25L', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 0, minStock: 2 },
  { name: 'Juguito Tutti 200cc', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 0, minStock: 2 },
  { name: 'Cerveza grande', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 0, minStock: 2 },
  { name: 'Cerveza chica', type: 'critical_supply', criticalSupplyType: 'beverage', price: 0, unit: 'botella', stock: 4, minStock: 2 },
  { name: 'Rollo de cocina', type: 'manual_supply', price: 0, unit: 'rollo', stock: 7, minStock: 0 },
  { name: 'Aceite', type: 'manual_supply', price: 0, unit: 'litro', stock: 4, minStock: 0 },
  { name: 'Vinagre', type: 'manual_supply', price: 0, unit: 'litro', stock: 4, minStock: 0 },
  { name: 'Detergente', type: 'manual_supply', price: 0, unit: 'litro', stock: 3, minStock: 0 },
  { name: 'Lavandina', type: 'manual_supply', price: 0, unit: 'litro', stock: 2, minStock: 0 },
  { name: 'Líquido piso', type: 'manual_supply', price: 0, unit: 'litro', stock: 0, minStock: 0 },
  { name: 'Sal gruesa', type: 'manual_supply', price: 0, unit: 'kg', stock: 4, minStock: 0 },
  { name: 'Vasos', type: 'manual_supply', price: 0, unit: 'unidad', stock: 9, minStock: 0 },
  { name: 'Cinta', type: 'manual_supply', price: 0, unit: 'unidad', stock: 4, minStock: 0 },
  { name: 'Tartarina', type: 'manual_supply', price: 0, unit: 'unidad', stock: 11, minStock: 0 },
  { name: 'Caldo', type: 'manual_supply', price: 0, unit: 'unidad', stock: 2, minStock: 0 },
];

const services: SeedProduct[] = [
  { name: 'Agregado de toppings', type: 'service', price: 200, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Vaso de gaseosa', type: 'service', price: 500, unit: 'unidad', stock: 0, minStock: 0 },
];

const promos: SeedProduct[] = [
  { name: 'Promo 1', type: 'compound', price: 1000, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo 2', type: 'compound', price: 1500, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo 3', type: 'compound', price: 2000, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Amigos 1', type: 'compound', price: 2500, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Amigos 2', type: 'compound', price: 3500, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Pritty 1', type: 'compound', price: 2000, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Pritty 2', type: 'compound', price: 2500, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Popular', type: 'compound', price: 10000, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Familiar', type: 'compound', price: 11000, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Familiar 2', type: 'compound', price: 16000, unit: 'unidad', stock: 0, minStock: 0 },
  { name: 'Promo Kids', type: 'compound', price: 2000, unit: 'unidad', stock: 0, minStock: 0 },
];

type SeedRecipeItem = {
  promo: string;
  items: { supplyName: string; quantity: number }[];
};

const promoRecipes: SeedRecipeItem[] = [
  { promo: 'Promo 1', items: [
    { supplyName: 'Pan', quantity: 1 },
    { supplyName: 'Salchichas', quantity: 2 },
  ]},
  { promo: 'Promo 2', items: [
    { supplyName: 'Pan', quantity: 1 },
    { supplyName: 'Salchichas', quantity: 2 },
  ]},
  { promo: 'Promo 3', items: [
    { supplyName: 'Pan', quantity: 1 },
    { supplyName: 'Salchichas', quantity: 2 },
  ]},
  { promo: 'Promo Amigos 1', items: [
    { supplyName: 'Pan', quantity: 2 },
    { supplyName: 'Salchichas', quantity: 4 },
  ]},
  { promo: 'Promo Amigos 2', items: [
    { supplyName: 'Pan', quantity: 2 },
    { supplyName: 'Salchichas', quantity: 4 },
  ]},
  { promo: 'Promo Pritty 1', items: [
    { supplyName: 'Pan', quantity: 1 },
    { supplyName: 'Salchichas', quantity: 2 },
    { supplyName: 'Pritty 500cc', quantity: 1 },
  ]},
  { promo: 'Promo Pritty 2', items: [
    { supplyName: 'Pan', quantity: 1 },
    { supplyName: 'Salchichas', quantity: 2 },
    { supplyName: 'Pritty 500cc', quantity: 1 },
  ]},
  { promo: 'Promo Popular', items: [
    { supplyName: 'Pan', quantity: 5 },
    { supplyName: 'Salchichas', quantity: 10 },
    { supplyName: 'Doble Cola 2,25L', quantity: 1 },
  ]},
  { promo: 'Promo Familiar', items: [
    { supplyName: 'Pan', quantity: 9 },
    { supplyName: 'Salchichas', quantity: 18 },
    { supplyName: 'Doble Cola 2,25L', quantity: 1 },
  ]},
  { promo: 'Promo Familiar 2', items: [
    { supplyName: 'Pan', quantity: 9 },
    { supplyName: 'Salchichas', quantity: 18 },
    { supplyName: 'Doble Cola 2,25L', quantity: 1 },
  ]},
  { promo: 'Promo Kids', items: [
    { supplyName: 'Pan', quantity: 1 },
    { supplyName: 'Salchichas', quantity: 2 },
    { supplyName: 'Juguito Tutti 200cc', quantity: 1 },
  ]},
];

async function seedCatalog(branchId: number) {
  const existingProducts = await db.query.products.findMany({
    columns: { id: true },
    where: eq(products.branchId, branchId),
    limit: 1,
  });

  if (existingProducts.length > 0) {
    console.log('Ya existen productos para esta sucursal. Se omite el seed del catálogo.');
    return;
  }

  const seedSources = [...baseProducts, ...services, ...promos];
  const initialStockByName = new Map<string, number>();
  for (const p of seedSources) {
    initialStockByName.set(p.name, p.stock);
  }

  const allProducts = seedSources.map((p) => ({
    ...p,
    branchId,
    stock: 0,
    minStock: p.minStock ?? 0,
    criticalSupplyType: p.criticalSupplyType ?? null,
    isActive: true,
  }));

  const seededProducts = await db
    .insert(products)
    .values(allProducts)
    .returning({ id: products.id, name: products.name });

  const findProduct = (name: string) =>
    seededProducts.find((p) => p.name === name);

  const recipeRows = [];

  for (const recipe of promoRecipes) {
    const promo = findProduct(recipe.promo);
    if (!promo) {
      console.error(`No se encontró la promo ${recipe.promo}`);
      continue;
    }

    for (const item of recipe.items) {
      const supply = findProduct(item.supplyName);
      if (!supply) {
        console.error(`No se encontró el insumo ${item.supplyName} para ${recipe.promo}`);
        continue;
      }

      recipeRows.push({
        compoundProductId: promo.id,
        supplyId: supply.id,
        quantity: item.quantity,
        autoDiscount: true,
      });
    }
  }

  if (recipeRows.length > 0) {
    await db.insert(recipes).values(recipeRows);
  }

  for (const seeded of seededProducts) {
    const initialStock = initialStockByName.get(seeded.name) ?? 0;
    if (initialStock > 0) {
      await stockService.adjustStock(
        branchId,
        seeded.id,
        initialStock,
        'Stock inicial',
        'restock'
      );
    }
  }

  console.log('Catálogo de productos, servicios y promos creado.');
}

async function main() {
  try {
    const defaultBranchId = await seedDefaultBranch();
    await seedAdmin(defaultBranchId);
    await seedCatalog(defaultBranchId);
    await seedOptionalBranch();
    process.exit(0);
  } catch (error) {
    console.error('Error al ejecutar el seed:', error);
    process.exit(1);
  }
}

main();
