# Plan de Implementación: Sistema de Gestión para Panchería (v1)

## 1. Resumen Ejecutivo

Este documento describe el plan paso a paso para construir un sistema web de gestión de stock y ventas para una panchería. El sistema está pensado para uso exclusivo del administrador, con una única cuenta de acceso, pantallas táctiles simples, control automático de insumos críticos (panes, salchichas y bebidas enteras), control manual de insumos de cocina/envase, registro de ventas con efectivo o transferencia, y cierre diario de caja.

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
6. Crear servicios de aplicación para autenticación, productos, ventas, stock y cierre.

### Fase 3: Autenticación

1. Instalar y configurar NextAuth v5 (Auth.js).
2. Crear esquema de credenciales con usuario y contraseña hash.
3. Implementar middleware de protección de rutas.
4. Crear pantalla de inicio de sesión.

### Fase 4: Gestión de productos e insumos

1. Crear páginas y formularios de productos con Zod.
2. Implementar CRUD de productos e insumos con soft delete.
3. Crear selector de tipo de insumo crítico (pan, salchicha, bebida).
4. Implementar validación de stock mínimo y alertas.

### Fase 5: Recetas

1. Crear editor de recetas para productos compuestos.
2. Definir insumos críticos con descuento automático y manuales informativos.
3. Validar que las recetas tengan al menos un insumo crítico.

### Fase 6: Ventas

1. Diseñar pantalla de ventas rápidas y táctil.
2. Mostrar productos activos y bebidas.
3. Validar disponibilidad según stock crítico.
4. Implementar carrito con cantidades y totales.
5. Seleccionar forma de pago (efectivo o transferencia).
6. Confirmar venta con descuento atómico de stock.
7. Implementar anulación de ventas con reintegro de stock.

### Fase 7: Stock

1. Crear pantalla de stock general con alertas.
2. Implementar historial de movimientos.
3. Crear formulario de ajuste manual con motivo.

### Fase 8: Reportes y cierre de caja

1. Crear pantalla de cierre diario.
2. Calcular totales, medios de pago y consumo de insumos críticos.
3. Generar resumen histórico por fecha.
4. Permitir impresión o exportación simple (PDF/CSV opcional).

### Fase 9: Testing

1. Configurar Jest para tests unitarios.
2. Escribir tests de servicios de aplicación y lógica de ventas.
3. Configurar Playwright para tests end-to-end.
4. Escribir tests de login, venta, anulación y cierre.

### Fase 10: Despliegue

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
    │   │       └── page.tsx
    │   ├── (panel)/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx                     # dashboard
    │   │   ├── productos/
    │   │   │   ├── page.tsx
    │   │   │   ├── [id]/
    │   │   │   │   └── editar/
    │   │   │   │       └── page.tsx
    │   │   │   └── nuevo/
    │   │   │       └── page.tsx
    │   │   ├── recetas/
    │   │   │   └── [productId]/
    │   │   │       └── editar/
    │   │   │           └── page.tsx
    │   │   ├── ventas/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/
    │   │   │       └── page.tsx
    │   │   ├── stock/
    │   │   │   └── page.tsx
    │   │   └── cierre/
    │   │       └── page.tsx
    │   ├── api/
    │   │   ├── auth/
    │   │   │   └── [...nextauth]/
    │   │   │       └── route.ts
    │   │   ├── productos/
    │   │   │   └── route.ts
    │   │   ├── productos/[id]/
    │   │   │   └── route.ts
    │   │   ├── recetas/
    │   │   │   └── route.ts
    │   │   ├── ventas/
    │   │   │   └── route.ts
    │   │   ├── ventas/[id]/
    │   │   │   └── anular/
    │   │   │       └── route.ts
    │   │   ├── stock/
    │   │   │   └── ajustar/
    │   │   │       └── route.ts
    │   │   └── cierre/
    │   │       └── route.ts
    │   ├── globals.css
    │   └── layout.tsx
    ├── components/
    │   ├── ui/                              # componentes de shadcn/ui
    │   ├── productos/
    │   ├── ventas/
    │   ├── stock/
    │   └── cierre/
    ├── db/
    │   ├── index.ts
    │   ├── schema.ts
    │   └── seeds.ts
    ├── lib/
    │   ├── money.ts
    │   ├── zod-schemas.ts
    │   └── utils.ts
    ├── repositories/
    │   ├── productRepository.ts
    │   ├── recipeRepository.ts
    │   ├── saleRepository.ts
    │   ├── stockMovementRepository.ts
    │   └── dailyClosureRepository.ts
    ├── application/
    │   ├── services/
    │   │   ├── authService.ts
    │   │   ├── productService.ts
    │   │   ├── recipeService.ts
    │   │   ├── saleService.ts
    │   │   ├── stockService.ts
    │   │   └── closureService.ts
    │   └── transactionService.ts
    ├── domain/
    │   ├── types.ts
    │   └── errors.ts
    ├── auth.ts
    ├── auth.config.ts
    └── middleware.ts
```

## 4. Dependencias

### Core

- `next`: ^16.0.0
- `react`: ^19.0.0
- `react-dom`: ^19.0.0
- `typescript`: ^5.x
- `tailwindcss`: ^4.x o ^3.4.x según la plantilla de shadcn/ui
- `@tailwindcss/postcss` (si aplica)

### Autenticación

- `next-auth`: ^5.0.0-beta.x (Auth.js para Next.js)
- `@auth/drizzle-adapter`

### Base de datos

- `drizzle-orm`
- `drizzle-kit`
- `pg`
- `@neondatabase/serverless`
- `dotenv`

### Validación y utilidades

- `zod`
- `dinero.js` o `@dinerojs/currencies` para Money
- `date-fns` para manejo de fechas
- `uuid` o `nanoid` para claves de idempotencia

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

### Comando de instalación sugerido

```bash
npm install next@^16 react@^19 react-dom@^19 typescript @types/node @types/react @types/react-dom tailwindcss postcss autoprefixer
npx shadcn@latest init --yes --template next --base-color neutral
npm install next-auth@beta @auth/drizzle-adapter
npm install drizzle-orm drizzle-kit pg @neondatabase/serverless dotenv
npm install zod dinero.js @dinerojs/currencies date-fns nanoid
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install -D jest @testing-library/react @testing-library/jest-dom ts-jest @playwright/test @types/jest
```

## 5. Esquema de Base de Datos (Drizzle)

### Archivo `src/db/schema.ts`

```typescript
import { pgTable, serial, varchar, text, integer, boolean, timestamp, numeric, pgEnum } from 'drizzle-orm/pg-core';

export const productTypeEnum = pgEnum('product_type', ['critical_supply', 'compound', 'manual_supply']);
export const criticalSupplyTypeEnum = pgEnum('critical_supply_type', ['bread', 'sausage', 'beverage']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'transfer']);
export const saleStatusEnum = pgEnum('sale_status', ['active', 'cancelled']);
export const stockMovementTypeEnum = pgEnum('stock_movement_type', ['sale', 'cancellation', 'manual_adjustment', 'restock']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: productTypeEnum('type').notNull(),
  criticalSupplyType: criticalSupplyTypeEnum('critical_supply_type'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  unit: varchar('unit', { length: 50 }).notNull(),
  stock: integer('stock').default(0).notNull(),
  minStock: integer('min_stock').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const recipes = pgTable('recipes', {
  id: serial('id').primaryKey(),
  compoundProductId: integer('compound_product_id').notNull().references(() => products.id),
  supplyId: integer('supply_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  autoDiscount: boolean('auto_discount').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  status: saleStatusEnum('status').default('active').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
});

export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  saleId: integer('sale_id').notNull().references(() => sales.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
});

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  type: stockMovementTypeEnum('type').notNull(),
  quantity: integer('quantity').notNull(),
  reason: text('reason'),
  saleId: integer('sale_id').references(() => sales.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const dailyClosures = pgTable('daily_closures', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull().unique(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  cashTotal: numeric('cash_total', { precision: 10, scale: 2 }).notNull(),
  transferTotal: numeric('transfer_total', { precision: 10, scale: 2 }).notNull(),
  totalSales: integer('total_sales').notNull(),
  productsSummary: text('products_summary').notNull(),
  criticalSuppliesSummary: text('critical_supplies_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Relaciones e índices

- Índice en `products(type)`.
- Índice en `products(is_active, deleted_at)`.
- Índice en `recipes(compound_product_id)`.
- Índice en `sale_items(sale_id)`.
- Índice en `stock_movements(product_id, created_at)`.
- Índice en `sales(created_at)`.

## 6. Endpoints de API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/[...nextauth]` | Inicio y cierre de sesión con NextAuth v5 |
| GET/POST | `/api/productos` | Listar y crear productos |
| GET/PUT/DELETE | `/api/productos/[id]` | Obtener, actualizar o eliminar producto |
| POST | `/api/recetas` | Crear o actualizar receta de producto compuesto |
| GET | `/api/recetas?productId=x` | Obtener receta de un producto |
| POST | `/api/ventas` | Confirmar venta |
| GET | `/api/ventas` | Listar ventas del día |
| GET | `/api/ventas/[id]` | Detalle de venta |
| POST | `/api/ventas/[id]/anular` | Anular venta y reintegrar stock |
| POST | `/api/stock/ajustar` | Ajustar stock manualmente |
| GET | `/api/stock` | Obtener stock con alertas |
| GET | `/api/cierre` | Obtener cierre diario |
| POST | `/api/cierre` | Generar cierre diario |

### Validación Zod sugerida

```typescript
import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.enum(['critical_supply', 'compound', 'manual_supply']),
  criticalSupplyType: z.enum(['bread', 'sausage', 'beverage']).optional().nullable(),
  price: z.coerce.number().nonnegative(),
  unit: z.string().min(1).max(50),
  stock: z.coerce.number().int().nonnegative(),
  minStock: z.coerce.number().int().nonnegative(),
  isActive: z.coerce.boolean(),
});

export const recipeItemSchema = z.object({
  supplyId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  autoDiscount: z.boolean(),
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
```

## 7. Pantallas y Componentes

### 7.1 Pantalla de login

- Formulario con usuario y contraseña.
- Validación con Zod en cliente y servidor.
- Redirección al panel al autenticarse.

### 7.2 Panel de ventas

- Grilla táctil de productos activos.
- Tarjetas grandes con nombre, precio y stock disponible.
- Selector de cantidad por producto.
- Resumen del pedido con subtotal y total.
- Botones de pago: efectivo y transferencia.
- Botón de confirmar venta con idempotencia.

### 7.3 Productos

- Tabla de productos con filtros por tipo.
- Formulario de creación y edición.
- Botón de activar/inactivar y eliminar (soft delete).
- Indicador de stock bajo.

### 7.4 Recetas

- Pantalla accesible desde productos compuestos.
- Lista de insumos con cantidad y tipo de descuento.
- Buscador de insumos existentes.
- Botón de guardar receta.

### 7.5 Stock

- Lista de productos con stock actual, mínimo y estado.
- Alertas visuales para stock bajo.
- Botón de ajuste manual con motivo.
- Historial de movimientos por producto.

### 7.6 Cierre de caja

- Resumen del día: total, efectivo, transferencia, cantidad de ventas.
- Listado de productos vendidos.
- Consumo de insumos críticos.
- Stock actual de insumos críticos.
- Botón de imprimir o exportar.
- Calendario para consultar cierres históricos.

### Componentes de shadcn/ui sugeridos

- `button`
- `card`
- `input`
- `label`
- `select`
- `dialog`
- `table`
- `badge`
- `tabs`
- `toast` o `sonner`
- `scroll-area`
- `calendar`

## 8. Autenticación

### Configuración de NextAuth v5

Archivo `src/auth.ts`:

```typescript
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { loginSchema } from '@/lib/zod-schemas';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Usuario' },
        password: { label: 'Contraseña', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.parse(credentials);
        const user = await db.query.users.findFirst({
          where: eq(users.username, parsed.username),
        });
        if (!user) return null;
        const isValid = await bcrypt.compare(parsed.password, user.passwordHash);
        if (!isValid) return null;
        return { id: String(user.id), name: user.username };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
});
```

Archivo `src/middleware.ts`:

```typescript
export { auth as middleware } from '@/auth';

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
};
```

### Variables de entorno

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generar_con_openssl_rand_base64_32
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=hash_generado_con_bcrypt
DATABASE_URL=postgresql://...
```

> Nota: las credenciales de administrador se obtienen de las variables de entorno. No deben estar hardcodeadas en el código fuente.

### Seed del administrador

```typescript
import { db } from '@/db';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';

export async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const exists = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (exists) return;
  await db.insert(users).values({
    username,
    passwordHash: await bcrypt.hash(password, 10),
  });
}
```

## 9. Lógica de Ventas, Recetas, Stock Crítico y Manual

### 9.1 Cálculo de disponibilidad

Para un producto compuesto, la cantidad máxima vendible está dada por el insumo crítico con menor relación `stock / cantidadEnReceta`.

```typescript
function calcularDisponibilidad(producto: Producto, receta: Receta[], stock: Record<number, number>): number {
  const criticos = receta.filter((r) => r.autoDiscount);
  if (criticos.length === 0) return 0;
  return Math.min(...criticos.map((r) => Math.floor(stock[r.supplyId] / r.quantity)));
}
```

### 9.2 Confirmación de venta

Flujo dentro de `transactionService.execute`:

1. Verificar clave de idempotencia.
2. Validar cada ítem de la venta con Zod.
3. Para cada producto compuesto, calcular disponibilidad.
4. Para cada producto compuesto y cada insumo crítico de su receta, descontar `cantidadReceta * cantidadVendida` del stock.
5. Para cada insumo crítico vendido directamente, descontar la cantidad vendida de su stock.
6. Para cada bebida entera, descontar unidades del stock.
7. Insertar la venta, los ítems y los movimientos de stock.
8. Calcular el total usando `Money`.

### 9.3 Anulación de venta

Flujo:

1. Buscar la venta por ID.
2. Si ya está anulada, retornar.
3. Reintegrar el stock de todos los insumos críticos que se descontaron en la venta.
4. Crear movimientos de tipo `cancellation`.
5. Marcar la venta como `cancelled` con fecha y motivo.

### 9.4 Stock manual

Los insumos manuales se muestran en la receta como informativos. No se descuentan automáticamente. Se ajustan desde la pantalla de stock con motivo: compra, merma, cierre de envase o corrección.

## 10. Manejo de Dinero

Utilizar `dinero.js` para evitar errores de punto flotante.

```typescript
import { dinero, add, multiply, toDecimal } from 'dinero.js';
import { ARS } from '@dinerojs/currencies';

export function parseMoney(amount: number) {
  return dinero({ amount: Math.round(amount * 100), currency: ARS });
}

export function moneyToNumber(money: any) {
  return Number(toDecimal(money));
}

export function moneyToString(money: any) {
  return toDecimal(money);
}
```

Todos los precios, totales, subtotales y reportes se calculan con `dinero`.

## 11. Transacciones e Idempotencia

### transactionService

```typescript
import { db } from '@/db';

export async function executeInTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    return await fn(tx);
  });
}
```

### idempotencyService

```typescript
import { db } from '@/db';
import { sales } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function isIdempotencyKeyUsed(key: string) {
  const existing = await db.query.sales.findFirst({
    where: eq(sales.idempotencyKey, key),
  });
  return !!existing;
}
```

La clave de idempotencia se genera en el cliente para cada intento de confirmación de venta.

## 12. Reportes y Cierre de Caja

### Cierre diario

El cierre se genera al finalizar el día y persiste en `daily_closures`.

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

## 13. Testing

### 13.1 Tests unitarios con Jest

Cobertura mínima:

- `productService.test.ts`: CRUD y soft delete.
- `saleService.test.ts`: cálculo de disponibilidad, descuento de stock, anulación.
- `stockService.test.ts`: ajuste manual y alertas.
- `money.test.ts`: conversiones y cálculos con dinero.

### 13.2 Tests end-to-end con Playwright

Escenarios:

1. Login fallido y exitoso.
2. Crear un producto compuesto con receta.
3. Realizar una venta y verificar descuento de stock.
4. Anular una venta y verificar reintegro.
5. Generar cierre diario y validar totales.

### 13.3 Configuración de Jest

```typescript
// jest.config.ts
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
```

## 14. Despliegue

### 14.1 GitHub

1. Inicializar repositorio local: `git init`.
2. Crear `.gitignore` para Next.js, Vercel, Neon y dependencias.
3. Hacer commit de los archivos.
4. Crear repositorio remoto en GitHub.
5. Subir cambios a la rama principal.

### 14.2 Vercel

1. Importar proyecto desde GitHub.
2. Configurar framework preset: Next.js.
3. Agregar variables de entorno:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (dominio de Vercel)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
4. Ejecutar migraciones desde consola local o script de build:
   - `npx drizzle-kit push`.
5. Desplegar y verificar.

### 14.3 Neon

1. Crear proyecto y base de datos.
2. Copiar la URL de conexión.
3. Configurar migraciones en producción.
4. Ejecutar seed de administrador una sola vez.

## 15. Decisiones Técnicas

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
| Transacciones atómicas | Garantiza consistencia de stock y ventas. |
| Zod | Validaciones robustas y tipadas en formularios y endpoints. |

## 16. Exclusiones

- Sin pasarela de pagos reales.
- Sin facturación electrónica.
- Sin múltiples roles ni usuarios.
- Sin tienda online pública.
- Sin delivery ni integraciones con terceros.
- Sin notificaciones push ni por correo.

## 17. Checklist de Ejecución

- [ ] Proyecto Next.js 16 creado con TypeScript y Tailwind.
- [ ] shadcn/ui instalado y componentes base listos.
- [ ] Drizzle ORM conectado a PostgreSQL en Neon.
- [ ] Esquema de base de datos creado y migrado.
- [ ] NextAuth v5 configurado con una sola cuenta de administrador.
- [ ] Login funcional y rutas protegidas.
- [ ] CRUD de productos e insumos con soft delete.
- [ ] Recetas para productos compuestos.
- [ ] Pantalla de ventas táctil con validación de stock.
- [ ] Descuento automático de panes, salchichas y bebidas.
- [ ] Stock manual con ajustes y alertas.
- [ ] Anulación de ventas con reintegro.
- [ ] Cierre diario con resumen.
- [ ] Tests unitarios con Jest.
- [ ] Tests E2E con Playwright.
- [ ] Código en GitHub y desplegado en Vercel.

## 18. Próximos Pasos Sugeridos

1. Validar este plan con el cliente o usuario final.
2. Priorizar las funcionalidades si es necesario un MVP más reducido.
3. Generar el `environment.yaml` para el entorno de desarrollo estandarizado.
4. Iniciar la Fase 0 y crear el repositorio.
