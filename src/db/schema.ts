import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

export const productTypeEnum = pgEnum('product_type', [
  'critical_supply',
  'compound',
  'manual_supply',
]);

export const criticalSupplyTypeEnum = pgEnum('critical_supply_type', [
  'bread',
  'sausage',
  'beverage',
]);

export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer']);

export const saleStatusEnum = pgEnum('sale_status', ['active', 'cancelled']);

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'sale',
  'cancellation',
  'manual_adjustment',
  'restock',
]);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: productTypeEnum('type').notNull(),
    criticalSupplyType: criticalSupplyTypeEnum('critical_supply_type'),
    price: numeric('price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    unit: varchar('unit', { length: 50 }).notNull(),
    stock: integer('stock').default(0).notNull(),
    minStock: integer('min_stock').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    typeIdx: index('products_type_idx').on(table.type),
    activeDeletedIdx: index('products_active_deleted_idx').on(
      table.isActive,
      table.deletedAt
    ),
  })
);

export const recipes = pgTable(
  'recipes',
  {
    id: serial('id').primaryKey(),
    compoundProductId: integer('compound_product_id')
      .notNull()
      .references(() => products.id),
    supplyId: integer('supply_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    autoDiscount: boolean('auto_discount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    compoundProductIdx: index('recipes_compound_product_idx').on(
      table.compoundProductId
    ),
  })
);

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    status: saleStatusEnum('status').default('active').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => ({
    createdAtIdx: index('sales_created_at_idx').on(table.createdAt),
  })
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  },
  (table) => ({
    saleIdx: index('sale_items_sale_idx').on(table.saleId),
  })
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    type: stockMovementTypeEnum('type').notNull(),
    quantity: integer('quantity').notNull(),
    reason: text('reason'),
    saleId: integer('sale_id').references(() => sales.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    productCreatedAtIdx: index('stock_movements_product_created_at_idx').on(
      table.productId,
      table.createdAt
    ),
  })
);

export const dailyClosures = pgTable('daily_closures', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull().unique(),
  total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  cashTotal: numeric('cash_total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  transferTotal: numeric('transfer_total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  totalSales: integer('total_sales').notNull(),
  productsSummary: text('products_summary').notNull(),
  criticalSuppliesSummary: text('critical_supplies_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ many }) => ({
  recipes: many(recipes, { relationName: 'compoundProduct' }),
  supplyRecipes: many(recipes, { relationName: 'supply' }),
  saleItems: many(saleItems),
  stockMovements: many(stockMovements),
}));

export const recipesRelations = relations(recipes, ({ one }) => ({
  compoundProduct: one(products, {
    fields: [recipes.compoundProductId],
    references: [products.id],
    relationName: 'compoundProduct',
  }),
  supply: one(products, {
    fields: [recipes.supplyId],
    references: [products.id],
    relationName: 'supply',
  }),
}));

export const salesRelations = relations(sales, ({ many }) => ({
  items: many(saleItems),
  stockMovements: many(stockMovements),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  sale: one(sales, {
    fields: [stockMovements.saleId],
    references: [sales.id],
  }),
}));
