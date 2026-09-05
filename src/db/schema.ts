import { isNull, relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
  check,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Tipos de producto:
 * - `critical_supply`: insumos críticos que se descuentan automáticamente en ventas
 *   (pan, salchicha, bebida) y afectan la disponibilidad de productos compuestos.
 * - `compound`: productos compuestos formados por recetas de insumos críticos.
 * - `manual_supply`: insumos que NO se descuentan automáticamente en ventas.
 *   Sirven como aderezos/opcionales en recetas o como referencia informativa.
 *   Su stock debe ajustarse manualmente si se desea controlarlo.
 * - `service`: servicios o productos intangibles sin stock.
 */
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

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'in_process',
  'paid',
  'finished',
  'cancelled',
]);

export const orderMessageSenderEnum = pgEnum('order_message_sender', [
  'client',
  'operator',
]);

export const deliveryTypeEnum = pgEnum('delivery_type', ['delivery', 'pickup']);

export const stockMovementTypeEnum = pgEnum('stock_movement_type', [
  'sale',
  'cancellation',
  'manual_adjustment',
  'restock',
  'reserve',
  'reserve_release',
]);

export const cashRegisterStatusEnum = pgEnum('cash_register_status', [
  'open',
  'closed',
]);

export const userRoleEnum = pgEnum('user_role', ['admin', 'operator']);

export type BranchOpeningHours = {
  dayOfWeek: number;
  open: string;
  close: string;
};

export const branches = pgTable(
  'branches',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    openingHours: jsonb('opening_hours')
      .$type<BranchOpeningHours[]>()
      .default([])
      .notNull(),
    address: text('address'),
    phone: varchar('phone', { length: 50 }),
    location: text('location'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    deletedAtIdx: index('branches_deleted_at_idx').on(table.deletedAt),
    nameUniqueIdx: uniqueIndex('branches_name_active_unique_idx')
      .on(table.name)
      .where(isNull(table.deletedAt)),
  })
);

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').default('operator').notNull(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
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
      .references(() => branches.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: productTypeEnum('type').notNull(),
    criticalSupplyType: criticalSupplyTypeEnum('critical_supply_type'),
    price: numeric('price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    unit: varchar('unit', { length: 50 }).notNull(),
    stock: integer('stock').default(0).notNull(),
    minStock: integer('min_stock').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    imageUrl: text('image_url'),
    imageKey: text('image_key'),
    imageMimeType: varchar('image_mime_type', { length: 100 }),
    imageSize: integer('image_size'),
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
    stockCheck: check('products_stock_check', sql`${table.stock} >= 0`),
    minStockCheck: check('products_min_stock_check', sql`${table.minStock} >= 0`),
  })
);

export const recipes = pgTable(
  'recipes',
  {
    id: serial('id').primaryKey(),
    compoundProductId: integer('compound_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    supplyId: integer('supply_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    autoDiscount: boolean('auto_discount').notNull(),
    isOptional: boolean('is_optional').default(false).notNull(),
    selectedByDefault: boolean('selected_by_default').default(false).notNull(),
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
      .references(() => branches.id, { onDelete: 'restrict' }),
    openedAt: timestamp('opened_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
    openedBy: varchar('opened_by', { length: 255 }).notNull(),
    closedBy: varchar('closed_by', { length: 255 }),
    status: cashRegisterStatusEnum('status').default('open').notNull(),
    autoClosed: boolean('auto_closed').default(false).notNull(),
    initialAmount: numeric('initial_amount', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    cashTotal: numeric('cash_total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    transferTotal: numeric('transfer_total', { precision: 10, scale: 2, mode: 'number' }).default(0).notNull(),
    totalSales: integer('total_sales').default(0).notNull(),
    closingCashCount: numeric('closing_cash_count', { precision: 10, scale: 2, mode: 'number' }),
    closingDifference: numeric('closing_difference', { precision: 10, scale: 2, mode: 'number' }),
    closingNotes: text('closing_notes'),
    productsSummary: jsonb('products_summary')
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    criticalSuppliesSummary: jsonb('critical_supplies_summary')
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    recipeSuppliesSummary: jsonb('recipe_supplies_summary')
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
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
      .references(() => branches.id, { onDelete: 'restrict' }),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    status: saleStatusEnum('status').default('active').notNull(),
    cashRegisterId: integer('cash_register_id').references(() => cashRegisters.id, { onDelete: 'set null' }),
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

export const salePayments = pgTable(
  'sale_payments',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    method: paymentMethodEnum('method').notNull(),
    amount: numeric('amount', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    saleIdIdx: index('sale_payments_sale_id_idx').on(table.saleId),
  })
);

export const saleItems = pgTable(
  'sale_items',
  {
    id: serial('id').primaryKey(),
    saleId: integer('sale_id')
      .notNull()
      .references(() => sales.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  },
  (table) => ({
    saleIdx: index('sale_items_sale_idx').on(table.saleId),
  })
);

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    orderNumber: varchar('order_number', { length: 255 }).notNull(),
    total: numeric('total', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    status: orderStatusEnum('status').default('pending').notNull(),
    customerName: varchar('customer_name', { length: 255 }).notNull(),
    customerPhone: varchar('customer_phone', { length: 50 }).notNull(),
    deliveryType: deliveryTypeEnum('delivery_type').notNull(),
    address: text('address'),
    notes: text('notes'),
    cancellationToken: varchar('cancellation_token', { length: 255 }).notNull(),
    convertedSaleId: integer('converted_sale_id').references(() => sales.id, {
      onDelete: 'set null',
    }),
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    branchIdIdx: index('orders_branch_id_idx').on(table.branchId),
    statusIdx: index('orders_status_idx').on(table.status),
    createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
    branchStatusDeletedAtIdx: index('orders_branch_status_deleted_at_idx').on(
      table.branchId,
      table.status,
      table.deletedAt
    ),
    orderNumberUniqueIdx: uniqueIndex('orders_order_number_unique_idx').on(
      table.branchId,
      table.orderNumber
    ),
    orderNumberIdx: index('orders_order_number_idx').on(table.orderNumber),
    customerNameIdx: index('orders_customer_name_idx').on(table.customerName),
    customerPhoneIdx: index('orders_customer_phone_idx').on(table.customerPhone),
    cancellationTokenUniqueIdx: uniqueIndex('orders_cancellation_token_unique_idx').on(
      table.cancellationToken
    ),
    idempotencyUniqueIdx: uniqueIndex('orders_idempotency_branch_unique_idx').on(
      table.branchId,
      table.idempotencyKey
    ),
  })
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
    subtotal: numeric('subtotal', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  },
  (table) => ({
    orderIdx: index('order_items_order_idx').on(table.orderId),
  })
);

export const saleItemRecipes = pgTable(
  'sale_item_recipes',
  {
    id: serial('id').primaryKey(),
    saleItemId: integer('sale_item_id')
      .notNull()
      .references(() => saleItems.id, { onDelete: 'cascade' }),
    supplyId: integer('supply_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    supplyName: varchar('supply_name', { length: 255 }).notNull(),
    supplyType: productTypeEnum('supply_type').notNull(),
    quantity: integer('quantity').notNull(),
    autoDiscount: boolean('auto_discount').notNull(),
    isOptional: boolean('is_optional').notNull(),
    selected: boolean('selected').notNull(),
    selectedByDefault: boolean('selected_by_default').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    saleItemIdx: index('sale_item_recipes_sale_item_id_idx').on(table.saleItemId),
  })
);

export const orderItemRecipes = pgTable(
  'order_item_recipes',
  {
    id: serial('id').primaryKey(),
    orderItemId: integer('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    supplyId: integer('supply_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    supplyName: varchar('supply_name', { length: 255 }).notNull(),
    supplyType: productTypeEnum('supply_type').notNull(),
    quantity: integer('quantity').notNull(),
    autoDiscount: boolean('auto_discount').notNull(),
    isOptional: boolean('is_optional').notNull(),
    selected: boolean('selected').notNull(),
    selectedByDefault: boolean('selected_by_default').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orderItemIdx: index('order_item_recipes_order_item_id_idx').on(table.orderItemId),
  })
);

export const orderStockReservations = pgTable(
  'order_stock_reservations',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index('order_stock_reservations_order_id_idx').on(table.orderId),
    productIdIdx: index('order_stock_reservations_product_id_idx').on(table.productId),
    branchProductIdx: index('order_stock_reservations_branch_product_idx').on(
      table.branchId,
      table.productId
    ),
  })
);

export const orderMessages = pgTable(
  'order_messages',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    senderType: orderMessageSenderEnum('sender_type').notNull(),
    senderName: varchar('sender_name', { length: 255 }),
    content: text('content'),
    attachmentUrl: text('attachment_url'),
    attachmentKey: text('attachment_key'),
    attachmentMimeType: varchar('attachment_mime_type', { length: 100 }),
    attachmentSize: integer('attachment_size'),
    attachmentName: varchar('attachment_name', { length: 255 }),
    deliveredAt: timestamp('delivered_at'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index('order_messages_order_id_idx').on(table.orderId),
    orderCreatedAtIdx: index('order_messages_order_created_at_idx').on(
      table.orderId,
      table.createdAt
    ),
    orderSenderReadAtIdx: index('order_messages_order_sender_read_at_idx').on(
      table.orderId,
      table.senderType,
      table.readAt
    ),
    attachmentKeyIdx: index('order_messages_attachment_key_idx').on(table.attachmentKey),
  })
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    type: stockMovementTypeEnum('type').notNull(),
    quantity: integer('quantity').notNull(),
    reason: text('reason'),
    saleId: integer('sale_id').references(() => sales.id, { onDelete: 'set null' }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
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

export const videos = pgTable(
  'videos',
  {
    id: serial('id').primaryKey(),
    branchId: integer('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    fileUrl: text('file_url').notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    branchIdIdx: index('videos_branch_id_idx').on(table.branchId),
    branchActiveDeletedIdx: index('videos_branch_active_deleted_idx').on(
      table.branchId,
      table.isActive,
      table.deletedAt
    ),
  })
);

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  products: many(products),
  cashRegisters: many(cashRegisters),
  sales: many(sales),
  orders: many(orders),
  stockMovements: many(stockMovements),
  videos: many(videos),
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
  orderItems: many(orderItems),
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
  payments: many(salePayments),
  stockMovements: many(stockMovements),
}));

export const saleItemsRelations = relations(saleItems, ({ one, many }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  recipeSnapshots: many(saleItemRecipes),
}));

export const salePaymentsRelations = relations(salePayments, ({ one }) => ({
  sale: one(sales, {
    fields: [salePayments.saleId],
    references: [sales.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  branch: one(branches, {
    fields: [orders.branchId],
    references: [branches.id],
  }),
  convertedSale: one(sales, {
    fields: [orders.convertedSaleId],
    references: [sales.id],
  }),
  items: many(orderItems),
  messages: many(orderMessages),
  stockReservations: many(orderStockReservations),
  stockMovements: many(stockMovements),
}));

export const orderMessagesRelations = relations(orderMessages, ({ one }) => ({
  order: one(orders, {
    fields: [orderMessages.orderId],
    references: [orders.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  recipeSnapshots: many(orderItemRecipes),
}));

export const saleItemRecipesRelations = relations(saleItemRecipes, ({ one }) => ({
  saleItem: one(saleItems, {
    fields: [saleItemRecipes.saleItemId],
    references: [saleItems.id],
  }),
  supply: one(products, {
    fields: [saleItemRecipes.supplyId],
    references: [products.id],
  }),
}));

export const orderItemRecipesRelations = relations(orderItemRecipes, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderItemRecipes.orderItemId],
    references: [orderItems.id],
  }),
  supply: one(products, {
    fields: [orderItemRecipes.supplyId],
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
  order: one(orders, {
    fields: [stockMovements.orderId],
    references: [orders.id],
  }),
}));



export const loginAttempts = pgTable('login_attempts', {
  username: varchar('username', { length: 255 }).primaryKey(),
  count: integer('count').notNull(),
  lastAttempt: bigint('last_attempt', { mode: 'number' }).notNull(),
});

export const publicOrderRateLimits = pgTable(
  'public_order_rate_limits',
  {
    scope: varchar('scope', { length: 64 }).notNull(),
    ip: varchar('ip', { length: 255 }).notNull(),
    count: integer('count').notNull(),
    resetAt: bigint('reset_at', { mode: 'number' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.ip] })]
);

export const videosRelations = relations(videos, ({ one }) => ({
  branch: one(branches, {
    fields: [videos.branchId],
    references: [branches.id],
  }),
}));
