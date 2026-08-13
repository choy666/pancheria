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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const productTypeEnum = pgEnum('product_type', [
  'critical_supply',
  'compound',
  'manual_supply',
  'service',
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

export const cashRegisterStatusEnum = pgEnum('cash_register_status', [
  'open',
  'closed',
]);

export const userRoleEnum = pgEnum('user_role', ['admin', 'operator']);

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').default('operator').notNull(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    branchIdIdx: index('users_branch_id_idx').on(table.branchId),
  })
);

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
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
    branchIdIdx: index('products_branch_id_idx').on(table.branchId),
    branchActiveDeletedIdx: index('products_branch_active_deleted_idx').on(
      table.branchId,
      table.isActive,
      table.deletedAt
    ),
    branchTypeIsActiveIdx: index('products_branch_type_is_active_idx').on(
      table.branchId,
      table.type,
      table.isActive,
      table.deletedAt
    ),
    nameIdx: index('products_name_idx').on(table.name),
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

export const cashRegisters = pgTable(
  'cash_registers',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    openedAt: timestamp('opened_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
    openedBy: varchar('opened_by', { length: 255 }).notNull(),
    closedBy: varchar('closed_by', { length: 255 }),
    status: cashRegisterStatusEnum('status').default('open').notNull(),
    autoClosed: boolean('auto_closed').default(false).notNull(),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    cashTotal: numeric('cash_total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    transferTotal: numeric('transfer_total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    totalSales: integer('total_sales').default(0).notNull(),
    // Nota: considerar migrar a jsonb para validación nativa de PostgreSQL.
    productsSummary: text('products_summary').default('{}').notNull(),
    // Nota: considerar migrar a jsonb para validación nativa de PostgreSQL.
    criticalSuppliesSummary: text('critical_supplies_summary').default('{}').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    branchIdIdx: index('cash_registers_branch_id_idx').on(table.branchId),
    statusIdx: index('cash_registers_status_idx').on(table.status),
    openedAtIdx: index('cash_registers_opened_at_idx').on(table.openedAt),
    deletedAtIdx: index('cash_registers_deleted_at_idx').on(table.deletedAt),
    branchStatusDeletedAtIdx: index('cash_registers_branch_status_deleted_at_idx').on(
      table.branchId,
      table.status,
      table.deletedAt
    ),
    openStatusIdx: uniqueIndex('cash_registers_open_status_idx')
      .on(table.branchId, table.status)
      .where(sql`${table.status} = 'open' AND ${table.deletedAt} IS NULL`),
  })
);

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    status: saleStatusEnum('status').default('active').notNull(),
    cashRegisterId: integer('cash_register_id').references(() => cashRegisters.id),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => ({
    branchIdIdx: index('sales_branch_id_idx').on(table.branchId),
    createdAtIdx: index('sales_created_at_idx').on(table.createdAt),
    branchCreatedAtIdx: index('sales_branch_created_at_idx').on(
      table.branchId,
      table.createdAt
    ),
    cashRegisterCreatedAtIdx: index('sales_cash_register_created_at_idx').on(
      table.cashRegisterId,
      table.createdAt
    ),
    idempotencyUniqueIdx: uniqueIndex('sales_idempotency_branch_unique_idx').on(
      table.branchId,
      table.idempotencyKey
    ),
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
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
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
    branchIdIdx: index('stock_movements_branch_id_idx').on(table.branchId),
    productCreatedAtIdx: index('stock_movements_product_created_at_idx').on(
      table.productId,
      table.createdAt
    ),
    branchProductCreatedAtIdx: index('stock_movements_branch_product_created_at_idx').on(
      table.branchId,
      table.productId,
      table.createdAt
    ),
  })
);

export const dailyClosures = pgTable(
  'daily_closures',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id),
    date: timestamp('date').notNull(),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    cashTotal: numeric('cash_total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    transferTotal: numeric('transfer_total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    totalSales: integer('total_sales').notNull(),
    // Nota: considerar migrar a jsonb para validación nativa de PostgreSQL.
    productsSummary: text('products_summary').notNull(),
    // Nota: considerar migrar a jsonb para validación nativa de PostgreSQL.
    criticalSuppliesSummary: text('critical_supplies_summary').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    branchDateUniqueIdx: uniqueIndex('daily_closures_branch_date_unique_idx').on(
      table.branchId,
      table.date
    ),
    branchDateIdx: index('daily_closures_branch_date_idx').on(
      table.branchId,
      table.date
    ),
  })
);

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  products: many(products),
  cashRegisters: many(cashRegisters),
  sales: many(sales),
  stockMovements: many(stockMovements),
  dailyClosures: many(dailyClosures),
}));

export const usersRelations = relations(users, ({ one }) => ({
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  branch: one(branches, {
    fields: [products.branchId],
    references: [branches.id],
  }),
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

export const cashRegistersRelations = relations(cashRegisters, ({ one, many }) => ({
  branch: one(branches, {
    fields: [cashRegisters.branchId],
    references: [branches.id],
  }),
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  branch: one(branches, {
    fields: [sales.branchId],
    references: [branches.id],
  }),
  cashRegister: one(cashRegisters, {
    fields: [sales.cashRegisterId],
    references: [cashRegisters.id],
  }),
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
  branch: one(branches, {
    fields: [stockMovements.branchId],
    references: [branches.id],
  }),
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  sale: one(sales, {
    fields: [stockMovements.saleId],
    references: [sales.id],
  }),
}));

export const dailyClosuresRelations = relations(dailyClosures, ({ one }) => ({
  branch: one(branches, {
    fields: [dailyClosures.branchId],
    references: [branches.id],
  }),
}));
