# Plan de Implementación: Sistema de Gestión para Panchería (v2)

## 1. Resumen Ejecutivo

Este documento describe el plan para el sistema web de gestión de stock y ventas de una panchería. El sistema está pensado para uso exclusivo del administrador, con una única cuenta de acceso, pantallas táctiles simples, control automático de insumos críticos (panes, salchichas y bebidas enteras), control manual de insumos de cocina/envase, registro de ventas con efectivo o transferencia, gestión de cajas y cierre diario de caja.

La versión 2 incorpora el módulo de **cajas** (`cash_registers`), que permite abrir y cerrar turnos de venta, calcular resúmenes en tiempo real, mantener un historial con papelera y realizar cierres automáticos. También se actualizan los endpoints, las pantallas y los flujos para reflejar el estado actual del producto.

## 2. Fases y Tareas

### Fase 0: Preparación del entorno

1. Crear repositorio en GitHub.
2. Clonar el repositorio en la máquina local.
3. Instalar Node.js 20 LTS o superior.
4. Crear proyecto Next.js 16 con `create-next-app` y la plantilla de shadcn/ui.
5. Configurar TypeScript, Tailwind CSS y el CLI de shadcn/ui.
6. Crear base de datos PostgreSQL en Neon y guardar `DATABASE_URL`.
7. Crear archivo `.env.local` con las variables de entorno necesarias.

### Fase 1: Configuración de base de datos y ORM

1. Instalar Drizzle ORM, Drizzle Kit, `pg` y el conector de Neon.
2. Configurar `drizzle.config.ts`.
3. Definir el esquema de base de datos en `src/db/schema.ts`.
4. Generar y ejecutar migraciones iniciales.
5. Crear seed de datos iniciales (administrador, productos de ejemplo, recetas).

### Fase 2: Arquitectura base

1. Crear estructura de carpetas según patrón Repository y Application Services.
2. Implementar `transactionService` para envolver escrituras atómicas.
3. Implementar `idempotencyService` para confirmación de ventas.
4. Implementar utilidades de dinero con `Money` y `parseMoney`.
5. Crear capa de repositorios para cada entidad.
6. Crear servicios de aplicación para autenticación, productos, ventas, stock, cierre y caja.

### Fase 3: Autenticación

1. Instalar y configurar NextAuth v5 (Auth.js).
2. Crear esquema de credenciales con usuario y contraseña hash.
3. Implementar protección de rutas mediante callback `authorized` de NextAuth.
4. Crear pantalla de inicio de sesión.

### Fase 4: Gestión de productos e insumos

1. Crear páginas y formularios de productos con Zod.
2. Implementar CRUD de productos e insumos con soft delete.
3. Crear selector de tipo de insumo crítico (pan, salchicha, bebida).
4. Implementar validación de stock mínimo y alertas.

### Fase 5: Recetas

1. Crear editor de recetas para productos compuestos.
2. Definir insumos críticos con descuento automático y manuales informativos.
3. Validar que las recetas tengan al menos un insumo crítico con descuento automático.

### Fase 6: Ventas

1. Diseñar pantalla de ventas rápidas y táctil.
2. Mostrar productos activos y bebidas.
3. Validar disponibilidad según stock crítico.
4. Implementar carrito con cantidades y totales.
5. Seleccionar forma de pago (efectivo o transferencia).
6. Confirmar venta con descuento atómico de stock e idempotencia.
7. Implementar anulación de ventas con reintegro de stock.
8. Asociar cada venta a la caja abierta.

### Fase 7: Stock

1. Crear pantalla de stock general con alertas.
2. Implementar historial de movimientos por producto.
3. Crear formulario de ajuste manual con motivo.

### Fase 8: Caja

1. Crear módulo de caja (`cash_registers`) con apertura y cierre.
2. Calcular resumen de caja en tiempo real (totales, medios de pago, productos e insumos críticos).
3. Implementar cierre automático de cajas abiertas tras un tiempo configurable.
4. Crear historial de cajas con posibilidad de eliminar y restaurar (papelera).
5. Mostrar resumen de caja en la terminal de ventas.

### Fase 9: Reportes y cierre diario

1. Crear pantalla de cierre diario.
2. Calcular totales, medios de pago y consumo de insumos críticos.
3. Generar resumen histórico por fecha.
4. Permitir exportación simple en CSV.
5. Mantener el cierre diario independiente del resumen por caja.

### Fase 10: Testing

1. Configurar Jest para tests unitarios.
2. Escribir tests de servicios de aplicación, repositorios y lógica de ventas.
3. Configurar Playwright para tests end-to-end.
4. Escribir tests de login, caja, venta, anulación, cierre y papelera.

### Fase 11: Despliegue

1. Subir código a GitHub.
2. Conectar repositorio a Vercel.
3. Configurar variables de entorno en Vercel.
4. Ejecutar migraciones en Neon.
5. Verificar despliegue y flujo completo.

## 3. Estructura de Carpetas

```
pancheria/
├── .env.local
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── .next/
├── drizzle/
│   └── meta/
├── drizzle.config.ts
├── jest.config.ts
├── jest.setup.ts
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   └── login/
    │   │       ├── page.tsx
    │   │       ├── login-form.tsx
    │   │       └── actions.ts
    │   ├── (panel)/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                     # dashboard
    │   │   ├── productos/
    │   │   │   ├── page.tsx
    │   │   │   ├── [id]/
    │   │   │   │   └── editar/
    │   │   │   │       └── page.tsx
    │   │   │   ├── nuevo/
    │   │   │   │   └── page.tsx
    │   │   │   └── actions.ts
    │   │   ├── recetas/
    │   │   │   └── [productId]/
    │   │   │       └── editar/
    │   │   │           └── page.tsx
    │   │   ├── ventas/
    │   │   │   ├── page.tsx
    │   │   │   └── historial/
    │   │   │       ├── page.tsx
    │   │   │       ├── [id]/
    │   │   │       │   └── page.tsx
    │   │   │       └── eliminadas/
    │   │   │           └── page.tsx
    │   │   ├── stock/
    │   │   │   └── page.tsx
    │   │   └── cierre/
    │   │       ├── page.tsx
    │   │       ├── historial/
    │   │       │   └── page.tsx
    │   │       └── [id]/
    │   │           └── page.tsx
    │   ├── api/
    │   │   ├── auth/
    │   │   │   └── [...nextauth]/
    │   │   │       └── route.ts
    │   │   ├── caja/
    │   │   │   ├── route.ts
    │   │   │   ├── abrir/
    │   │   │   │   └── route.ts
    │   │   │   ├── cerrar/
    │   │   │   │   └── route.ts
    │   │   │   ├── [id]/
    │   │   │   │   ├── route.ts
    │   │   │   │   ├── permanente/
    │   │   │   │   │   └── route.ts
    │   │   │   │   └── restaurar/
    │   │   │   │       └── route.ts
    │   │   │   ├── eliminadas/
    │   │   │   │   └── route.ts
    │   │   │   ├── historial/
    │   │   │   │   └── route.ts
    │   │   │   └── resumen/
    │   │   │       └── route.ts
    │   │   ├── cierre/
    │   │   │   ├── route.ts
    │   │   │   └── historial/
    │   │   │       └── route.ts
    │   │   ├── productos/
    │   │   │   ├── route.ts
    │   │   │   ├── [id]/
    │   │   │   │   └── route.ts
    │   │   │   └── disponibilidad/
    │   │   │       └── route.ts
    │   │   ├── recetas/
    │   │   │   └── route.ts
    │   │   ├── stock/
    │   │   │   ├── route.ts
    │   │   │   ├── ajustar/
    │   │   │   │   └── route.ts
    │   │   │   └── movimientos/
    │   │   │       └── route.ts
    │   │   └── ventas/
    │   │       ├── route.ts
    │   │       └── [id]/
    │   │           └── anular/
    │   │               └── route.ts
    │   ├── globals.css
    │   └── layout.tsx
    ├── components/
    │   ├── ui/                              # componentes de shadcn/ui
    │   ├── caja/
    │   ├── cierre/
    │   ├── panel/
    │   ├── productos/
    │   ├── stock/
    │   └── ventas/
    ├── config/
    │   ├── api.ts
    │   └── caja.ts
    ├── db/
    │   ├── index.ts
    │   ├── schema.ts
    │   └── seeds.ts
    ├── hooks/
    │   └── useCashRegister.ts
    ├── lib/
    │   ├── auth.ts
    │   ├── date.ts
    │   ├── money.ts
    │   ├── utils.ts
    │   └── zod-schemas.ts
    ├── repositories/
    │   ├── cashRegisterRepository.ts
    │   ├── dailyClosureRepository.ts
    │   ├── productRepository.ts
    │   ├── recipeRepository.ts
    │   ├── saleRepository.ts
    │   └── stockMovementRepository.ts
    ├── application/
    │   ├── services/
    │   │   ├── authService.ts
    │   │   ├── cashRegisterService.ts
    │   │   ├── closureService.ts
    │   │   ├── productService.ts
    │   │   ├── recipeService.ts
    │   │   ├── saleService.ts
    │   │   └── stockService.ts
    │   ├── idempotencyService.ts
    │   └── transactionService.ts
    ├── domain/
    │   ├── types.ts
    │   └── errors.ts
    ├── auth.ts
    ├── auth.config.ts
    └── proxy.ts
```

## 4. Dependencias

### Core

- `next`: ^16.3.0
- `react`: ^19.2.8
- `react-dom`: ^19.2.8
- `typescript`: ^5.x
- `tailwindcss`: ^4.x
- `@tailwindcss/postcss`

### Autenticación

- `next-auth`: ^5.0.0-beta.x (Auth.js)

### Base de datos

- `drizzle-orm`
- `drizzle-kit`
- `pg`
- `@neondatabase/serverless`
- `dotenv`

### Validación y utilidades

- `zod`
- `dinero.js`
- `date-fns`
- `nanoid`

### UI

- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `@radix-ui/*` (instalado por shadcn/ui)
- `lucide-react`

### Testing

- `jest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `ts-jest`
- `@playwright/test`

## 5. Esquema de Base de Datos (Drizzle)

### Archivo `src/db/schema.ts`

```typescript
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
  relations,
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

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'transfer',
]);

export const saleStatusEnum = pgEnum('sale_status', [
  'active',
  'cancelled',
]);

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
    price: numeric('price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
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

export const cashRegisters = pgTable(
  'cash_registers',
  {
    id: serial('id').primaryKey(),
    openedAt: timestamp('opened_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
    openedBy: varchar('opened_by', { length: 255 }).notNull(),
    closedBy: varchar('closed_by', { length: 255 }),
    status: cashRegisterStatusEnum('status').default('open').notNull(),
    autoClosed: boolean('auto_closed').default(false).notNull(),
    total: numeric('total', {
      precision: 10,
      scale: 2,
      mode: 'number',
    })
      .default(0)
      .notNull(),
    cashTotal: numeric('cash_total', {
      precision: 10,
      scale: 2,
      mode: 'number',
    })
      .default(0)
      .notNull(),
    transferTotal: numeric('transfer_total', {
      precision: 10,
      scale: 2,
      mode: 'number',
    })
      .default(0)
      .notNull(),
    totalSales: integer('total_sales').default(0).notNull(),
    productsSummary: text('products_summary').default('{}').notNull(),
    criticalSuppliesSummary: text('critical_supplies_summary')
      .default('{}')
      .notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('cash_registers_status_idx').on(table.status),
    openedAtIdx: index('cash_registers_opened_at_idx').on(table.openedAt),
    deletedAtIdx: index('cash_registers_deleted_at_idx').on(table.deletedAt),
  })
);

export const sales = pgTable(
  'sales',
  {
    id: serial('id').primaryKey(),
    total: numeric('total', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    status: saleStatusEnum('status').default('active').notNull(),
    cashRegisterId: integer('cash_register_id').references(
      () => cashRegisters.id
    ),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
  },
  (table) => ({
    createdAtIdx: index('sales_created_at_idx').on(table.createdAt),
    cashRegisterCreatedAtIdx: index('sales_cash_register_created_at_idx').on(
      table.cashRegisterId,
      table.createdAt
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
    unitPrice: numeric('unit_price', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
    subtotal: numeric('subtotal', {
      precision: 10,
      scale: 2,
      mode: 'number',
    }).notNull(),
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
  total: numeric('total', {
    precision: 10,
    scale: 2,
    mode: 'number',
  }).notNull(),
  cashTotal: numeric('cash_total', {
    precision: 10,
    scale: 2,
    mode: 'number',
  }).notNull(),
  transferTotal: numeric('transfer_total', {
    precision: 10,
    scale: 2,
    mode: 'number',
  }).notNull(),
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

export const cashRegistersRelations = relations(cashRegisters, ({ many }) => ({
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
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
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  sale: one(sales, {
    fields: [stockMovements.saleId],
    references: [sales.id],
  }),
}));
```

### Relaciones e índices

- Índice en `products(type)`.
- Índice en `products(is_active, deleted_at)`.
- Índice en `recipes(compound_product_id)`.
- Índice en `sale_items(sale_id)`.
- Índice en `stock_movements(product_id, created_at)`.
- Índice en `sales(created_at)`.
- Índice en `sales(cash_register_id, created_at)`.
- Índice en `cash_registers(status)`, `(opened_at)` y `(deleted_at)`.

## 6. Endpoints de API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/[...nextauth]` | Inicio y cierre de sesión con NextAuth v5 |
| GET/POST | `/api/productos` | Listar activos y crear producto |
| GET/PUT/DELETE | `/api/productos/[id]` | Obtener, actualizar o eliminar producto |
| GET | `/api/productos/disponibilidad?productId=x` | Calcular disponibilidad de un producto |
| GET | `/api/recetas?productId=x` | Obtener receta de un producto |
| POST | `/api/recetas` | Crear o actualizar receta de producto compuesto |
| GET | `/api/ventas` | Listar ventas del día o de una caja |
| POST | `/api/ventas` | Confirmar venta |
| POST | `/api/ventas/[id]/anular` | Anular venta y reintegrar stock |
| POST | `/api/stock/ajustar` | Ajustar stock manualmente |
| GET | `/api/stock` | Obtener stock con alertas |
| GET | `/api/stock/movimientos?productId=x` | Historial de movimientos de un producto |
| GET | `/api/cierre` | Obtener cierre diario por fecha |
| POST | `/api/cierre` | Generar cierre diario |
| GET | `/api/cierre/historial` | Listar cierres por rango de fechas |
| GET | `/api/caja` | Obtener caja abierta o estado `closed` |
| POST | `/api/caja/abrir` | Abrir una nueva caja |
| POST | `/api/caja/cerrar` | Cerrar la caja actual o una específica |
| GET | `/api/caja/[id]` | Detalle de una caja incluyendo ventas |
| DELETE | `/api/caja/[id]` | Mover una caja a la papelera |
| POST | `/api/caja/[id]/restaurar` | Restaurar una caja eliminada |
| POST | `/api/caja/[id]/permanente` | Eliminar permanentemente una caja de la papelera |
| GET | `/api/caja/historial` | Historial de cajas por rango y estado |
| GET | `/api/caja/eliminadas` | Cajas en la papelera por rango |
| GET | `/api/caja/resumen` | Resumen en tiempo real de la caja abierta |

### Validación Zod sugerida

```typescript
import { z } from 'zod';

const productBaseSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(['critical_supply', 'compound', 'manual_supply']),
  criticalSupplyType: z.enum(['bread', 'sausage', 'beverage']).optional().nullable(),
  price: z.coerce.number().nonnegative(),
  unit: z.string().min(1).max(50),
  stock: z.coerce.number().int().nonnegative().default(0),
  minStock: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().default(true),
});

export const productSchema = productBaseSchema
  .refine(
    (data) => !(data.type === 'critical_supply' && !data.criticalSupplyType),
    {
      message: 'Los insumos críticos deben tener un tipo de insumo crítico.',
      path: ['criticalSupplyType'],
    }
  )
  .refine(
    (data) => !(data.type !== 'critical_supply' && data.criticalSupplyType),
    {
      message: 'Solo los insumos críticos pueden tener un tipo de insumo crítico.',
      path: ['criticalSupplyType'],
    }
  );

export const productUpdateSchema = productBaseSchema.partial();

export const recipeItemSchema = z
  .object({
    supplyId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    autoDiscount: z.boolean(),
    supplyType: z.enum(['critical_supply', 'compound', 'manual_supply']).optional(),
  })
  .refine(
    (data) =>
      !data.autoDiscount || !data.supplyType || data.supplyType === 'critical_supply',
    {
      message: 'Solo los insumos críticos pueden tener descuento automático.',
      path: ['autoDiscount'],
    }
  );

export const recipeSchema = z
  .object({
    compoundProductId: z.number().int().positive(),
    items: z.array(recipeItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const supplyIds = data.items.map((item) => item.supplyId);

    if (new Set(supplyIds).size !== supplyIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'No puede haber insumos duplicados en la receta.',
        path: ['items'],
      });
    }

    if (supplyIds.includes(data.compoundProductId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Una receta no puede incluir al propio producto compuesto como insumo.',
        path: ['items'],
      });
    }
  });

export const saleItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const saleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.enum(['cash', 'transfer']),
  idempotencyKey: z.string().min(1),
});

export const stockAdjustmentSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int(),
  reason: z.string().min(3).max(500),
});

export const cancellationSchema = z.object({
  reason: z.string().min(3).max(500),
});
```

## 7. Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```env
# URL de conexión a PostgreSQL (Neon u otra instancia).
DATABASE_URL=postgresql://...

# URL base de la app, por defecto http://localhost:3000.
NEXTAUTH_URL=http://localhost:3000

# Secreto para firmar sesiones de NextAuth.
NEXTAUTH_SECRET=generar_con_openssl_rand_base64_32

# Usuario administrador único.
ADMIN_USERNAME=admin

# Contraseña en texto plano; el seed la hashea con bcrypt.
ADMIN_PASSWORD=...

# Intervalo de refresco del panel de caja en milisegundos.
NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS=5000
```

> Nota: las credenciales de administrador se obtienen de las variables de entorno. No deben estar hardcodeadas en el código fuente.

## 8. Configuración de NextAuth v5

Archivo `src/auth.config.ts`:

```typescript
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  providers: [],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === '/login';

      if (isLoginPage) {
        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
```

Archivo `src/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { verifyCredentials } from '@/application/services/authService';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const { username, password } = credentials as {
          username: string;
          password: string;
        };

        if (!username || !password) {
          return null;
        }

        const user = await verifyCredentials(username, password);

        if (!user) {
          return null;
        }

        return { id: user.id.toString(), name: user.username };
      },
    }),
  ],
});
```

### Seed del administrador

```typescript
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function seedAdmin() {
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
```

## 9. Lógica de Ventas, Recetas, Stock Crítico y Manual

### 9.1 Cálculo de disponibilidad

Para un producto compuesto, la cantidad máxima vendible está dada por el insumo crítico con menor relación `stock / cantidadEnReceta`.

```typescript
export async function calculateAvailability(productId: number): Promise<number> {
  const product = await productRepository.findById(productId);
  if (!product) return 0;

  if (product.type === 'compound') {
    const recipe = await db.query.recipes.findMany({
      where: eq(recipes.compoundProductId, productId),
      with: { supply: true },
    });

    const criticalItems = recipe.filter((r) => r.autoDiscount);
    if (criticalItems.length === 0) return 0;

    return Math.min(
      ...criticalItems.map((r) =>
        Math.floor((r.supply?.stock ?? 0) / r.quantity)
      )
    );
  }

  if (
    product.type === 'critical_supply' &&
    product.criticalSupplyType === 'beverage'
  ) {
    return product.stock;
  }

  return 0;
}
```

### 9.2 Confirmación de venta

Flujo dentro de `transactionService.execute`:

1. Verificar que exista una caja abierta.
2. Verificar clave de idempotencia.
3. Validar cada ítem de la venta con Zod.
4. Para cada producto compuesto, calcular disponibilidad.
5. Para cada producto compuesto y cada insumo crítico de su receta, descontar `cantidadReceta * cantidadVendida` del stock.
6. Para cada bebida entera, descontar la cantidad vendida de su stock.
7. Insertar la venta, los ítems y los movimientos de stock, asociando la venta a la caja abierta.
8. Calcular el total usando `Money`.

### 9.3 Anulación de venta

Flujo:

1. Buscar la venta por ID.
2. Si ya está anulada, retornar.
3. No permitir anular ventas de cajas eliminadas.
4. Reintegrar el stock de todos los insumos críticos que se descontaron en la venta.
5. Crear movimientos de tipo `cancellation`.
6. Marcar la venta como `cancelled` con fecha y motivo.

### 9.4 Stock manual

Los insumos manuales se muestran en la receta como informativos. No se descuentan automáticamente. Se ajustan desde la pantalla de stock con motivo: compra, merma, cierre de envase o corrección.

## 10. Módulo de Caja

### 10.1 Entidad `cash_registers`

Una caja representa un turno de ventas. Tiene los siguientes estados y campos clave:

- `status`: `open` o `closed`.
- `openedAt`, `closedAt`: fechas de apertura y cierre.
- `openedBy`, `closedBy`: usuario que abre o cierra.
- `autoClosed`: indica si se cerró automáticamente.
- `total`, `cashTotal`, `transferTotal`: totales calculados al cerrar.
- `totalSales`: cantidad de ventas asociadas.
- `productsSummary`, `criticalSuppliesSummary`: resúmenes serializados en JSON.
- `deletedAt`: permite soft delete y papelera.

### 10.2 Apertura y cierre

- No puede haber más de una caja abierta a la vez.
- Al cerrar se recalculan totales, medios de pago y consumo de insumos críticos de las ventas activas asociadas.
- El cierre puede ser manual desde la UI o automático cuando la caja supera un tiempo configurable (`AUTO_CLOSE_HOURS`, por defecto 12 horas).

### 10.3 Resumen en tiempo real

- `/api/caja/resumen` devuelve el resumen de la caja abierta calculado sobre el conjunto de ventas activas.
- El panel de caja se refresca automáticamente según `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS`.

### 10.4 Historial y papelera

- `/ventas/historial` muestra el historial de cajas cerradas.
- `/ventas/historial/eliminadas` muestra las cajas en papelera.
- Las cajas cerradas pueden moverse a papelera (soft delete) y restaurarse.
- Las cajas en papelera pueden eliminarse definitivamente; al hacerlo, sus ventas conservan `cashRegisterId = null`.

## 11. Manejo de Dinero

Utilizar `dinero.js` para evitar errores de punto flotante.

```typescript
import { dinero, toDecimal, add, multiply, type Dinero } from 'dinero.js';

export const ARS = {
  code: 'ARS',
  base: 10,
  exponent: 2,
} as const;

export type Money = Dinero<number, 'ARS'>;

export function parseMoney(amount: number): Money {
  return dinero({
    amount: Math.round(amount * 100),
    currency: ARS,
  });
}

export function moneyToNumber(money: Money): number {
  return Number(toDecimal(money));
}

export function moneyToString(money: Money): string {
  return toDecimal(money);
}

export function addMoney(a: Money, b: Money): Money {
  return add(a, b);
}

export function multiplyMoney(money: Money, factor: number): Money {
  return multiply(money, { amount: Math.round(factor * 100), scale: 2 });
}

export function sumMoney(monies: Money[]): Money {
  let total = dinero({ amount: 0, currency: ARS }) as Money;
  for (const money of monies) {
    total = add(total, money);
  }
  return total;
}
```

Todos los precios, totales, subtotales y reportes se calculan con `Money`.

## 12. Transacciones e Idempotencia

### transactionService

```typescript
import { db } from '@/db';

export async function executeInTransaction<T>(
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    return await fn(tx as unknown as typeof db);
  });
}
```

### idempotencyService

```typescript
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sales } from '@/db/schema';

export async function isIdempotencyKeyUsed(key: string): Promise<boolean> {
  const existing = await db.query.sales.findFirst({
    where: eq(sales.idempotencyKey, key),
  });
  return !!existing;
}
```

La clave de idempotencia se genera en el cliente para cada intento de confirmación de venta.

## 13. Reportes y Cierre Diario

### Cierre diario

El cierre se genera al finalizar el día y persiste en `daily_closures`. Se calcula por fecha UTC, independientemente de la caja asociada a cada venta.

```typescript
type CierreDiario = {
  date: Date;
  total: number;
  cashTotal: number;
  transferTotal: number;
  totalSales: number;
  productsSummary: Record<string, number>;
  criticalSuppliesSummary: Record<string, number>;
};
```

### Cálculo del cierre

1. Obtener ventas del día con estado `active`.
2. Sumar totales por medio de pago.
3. Agrupar ítems vendidos por producto.
4. Para productos compuestos, recorrer recetas y sumar consumo de insumos críticos.
5. Para bebidas vendidas directamente, sumar unidades.
6. Obtener stock actual de insumos críticos.
7. Persistir el cierre y devolver resumen.
8. Permitir exportar el resumen como CSV.

## 14. Pantallas y Componentes

### 14.1 Pantalla de login

- Formulario con usuario y contraseña.
- Validación con Zod en cliente y servidor.
- Redirección al panel al autenticarse.

### 14.2 Panel de control (dashboard)

- Accesos directos a Ventas, Productos, Stock y Cierre.

### 14.3 Panel de ventas

- Grilla táctil de productos activos (compuestos y bebidas).
- Tarjetas grandes con nombre, precio y stock disponible.
- Selector de cantidad por producto.
- Resumen del pedido con subtotal y total.
- Botones de pago: efectivo y transferencia.
- Botón de confirmar venta con idempotencia.
- Estado de la caja: abrir/cerrar y resumen en tiempo real.

### 14.4 Pantalla de productos

- Listado de productos con stock, mínimo, precio y estado.
- Alertas de stock bajo.
- Acciones: editar, eliminar (soft delete) y acceso al editor de receta para productos compuestos.
- Formulario de creación y edición con selector de tipo e insumo crítico.

### 14.5 Pantalla de recetas

- Editor de recetas para productos compuestos.
- Selección de insumos con cantidad y tipo de descuento.
- Validación de al menos un insumo crítico con descuento automático.

### 14.6 Pantalla de stock

- Listado de productos con alertas de stock bajo.
- Botones para ajustar stock y ver historial de movimientos.
- Formulario de ajuste con cantidad y motivo.

### 14.7 Pantalla de cierre

- Selector de fecha.
- Generación de cierre diario.
- Visualización de totales, productos vendidos e insumos críticos consumidos.
- Descarga de resumen en CSV.
- Panel de caja con apertura, cierre, resumen en vivo y tiempo restante hasta cierre automático.

### 14.8 Historial de cajas

- Listado de cajas cerradas con totales y estado.
- Acceso al detalle de cada caja, incluyendo ventas y resumen.
- Papelera de cajas eliminadas con opción de restaurar o eliminar permanentemente.

## 15. Testing

### 15.1 Tests unitarios con Jest

Cobertura mínima:

- `productService.test.ts`: CRUD, soft delete y cambio de tipo.
- `saleService.test.ts`: cálculo de disponibilidad, descuento de stock, anulación.
- `stockService.test.ts`: ajuste manual y alertas.
- `recipeService.test.ts`: validaciones de recetas.
- `cashRegisterService.test.ts`: apertura, cierre, resumen y papelera.
- `closureService.test.ts`: generación de cierre diario.
- `money.test.ts`: conversiones y cálculos con dinero.
- `zod-schemas.test.ts`: validaciones de esquemas.

### 15.2 Tests end-to-end con Playwright

Escenarios:

1. Login fallido y exitoso.
2. Crear un producto compuesto con receta.
3. Abrir caja, realizar una venta y verificar descuento de stock.
4. Anular una venta y verificar reintegro.
5. Generar cierre diario y validar totales.
6. Verificar historial de cajas, papelera y eliminación permanente.

### 15.3 Configuración de Jest

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  transform: {
    '^.+\\.(ts|tsx|js|mjs)$': 'ts-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(dinero\\.js)/)',
  ],
};

export default config;
```

## 16. Despliegue

### 16.1 GitHub

1. Inicializar repositorio local: `git init`.
2. Crear `.gitignore` para Next.js, Vercel, Neon y dependencias.
3. Hacer commit de los archivos.
4. Crear repositorio remoto en GitHub.
5. Subir cambios a la rama principal.

### 16.2 Vercel

1. Importar proyecto desde GitHub.
2. Configurar framework preset: Next.js.
3. Agregar variables de entorno:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (dominio de Vercel)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS`
4. Ejecutar migraciones desde consola local o script de build:
   - `npx drizzle-kit push`.
5. Desplegar y verificar.

### 16.3 Neon

1. Crear proyecto y base de datos.
2. Copiar la URL de conexión.
3. Configurar migraciones en producción.
4. Ejecutar seed de administrador una sola vez: `npx tsx src/db/seeds.ts`.

## 17. Decisiones Técnicas

| Decisión | Justificación |
|----------|---------------|
| Next.js 16 con App Router | Permite API routes, SSR y despliegue sencillo en Vercel. |
| React 19 | Versión estable y con mejoras de rendimiento. |
| Tailwind + shadcn/ui | Componentes accesibles, estilos rápidos y diseño táctil. |
| PostgreSQL en Neon | Base de datos serverless, escalable y compatible con Vercel. |
| Drizzle ORM | Tipado, cercano a SQL y fácil de migrar. |
| NextAuth v5 | Solución oficial para autenticación en Next.js. |
| Money con dinero.js | Evita errores de precisión en cálculos monetarios. |
| Repository + Application Services | Separa acceso a datos de lógica de negocio y facilita tests. |
| Transacciones atómicas | Garantiza consistencia de stock, ventas y caja. |
| Zod | Validaciones robustas y tipadas en formularios y endpoints. |

## 18. Exclusiones

- Sin pasarela de pagos reales.
- Sin facturación electrónica.
- Sin múltiples usuarios o roles.
- Sin sincronización offline.
- Sin impresión de tickets física.

## 19. Notas de cambios de v1 a v2

- Se agrega el módulo completo de **caja** (`cash_registers`) con apertura, cierre, resumen en vivo, cierre automático, historial y papelera.
- Las ventas quedan asociadas obligatoriamente a una caja abierta.
- Se agregan endpoints `/api/caja/*`, `/api/cierre/historial`, `/api/productos/disponibilidad`, `/api/stock/movimientos`.
- Se agregan pantallas de historial de cajas, detalle de caja, cajas eliminadas y cierre con panel de caja.
- Se renombra y amplía la fase de reportes para separar cierre diario y cierre de caja.
- Se actualiza la estructura de carpetas y dependencias.
- Se crea `src/proxy.ts` (convención de Next.js 16, antes `middleware.ts`) que exporta el proxy de autenticación de NextAuth; el callback `authorized` de `auth.config.ts` valida la sesión para las rutas protegidas.
