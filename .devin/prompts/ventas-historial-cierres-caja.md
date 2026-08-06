# Prompt: Historial de cierres de caja con ventas en `/ventas/historial`

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos y cierre de caja para una panchería.

Stack:

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline`)
- shadcn/ui v4 (componentes en `src/components/ui/*` basados en `@base-ui/react`)
- Drizzle ORM con PostgreSQL (Neon)
- NextAuth v5
- Patrón de arquitectura: repositorios + servicios de aplicación + dominio

Estado actual relevante:

- Existe la tabla `cash_registers` que representa aperturas y cierres de caja.
- Cada venta (`sales`) tiene un `cashRegisterId` que la vincula a la caja activa durante su venta.
- La página `src/app/(panel)/ventas/historial/page.tsx` muestra actualmente las ventas del día.
- La página `src/app/(panel)/cierre/historial/page.tsx` ya muestra un historial de cajas cerradas con `src/components/caja/caja-history.tsx`.
- El detalle de una caja existe en `src/app/(panel)/cierre/[id]/page.tsx` y muestra resúmenes, pero no la lista de ventas individuales.
- El servicio `cashRegisterService.getCashRegisterById(id)` (vía `cashRegisterRepository.findById(id)`) ya devuelve la caja con todas sus ventas e ítems, gracias a las relaciones de Drizzle.

## Objetivo

Convertir `/ventas/historial` en una página dedicada al **historial de cierres de caja**, donde se listen todas las aperturas/cierres de caja y, al seleccionar una, se muestren **todas las ventas realizadas durante esa apertura de caja**.

Navegación esperada:

- `/ventas/historial`: tabla con el historial de cajas (abiertas y cerradas) ordenadas por apertura descendente.
- `/ventas/historial/[id]`: detalle de la caja seleccionada con su resumen y la lista completa de ventas vinculadas a esa caja.

## Requisitos funcionales

1. La página `/ventas/historial` debe dejar de mostrar el listado diario de ventas y pasar a mostrar el historial de cajas.
2. El listado debe incluir, como mínimo, las siguientes columnas:
   - ID de caja.
   - Fecha/hora de apertura.
   - Fecha/hora de cierre (o indicador de que sigue abierta).
   - Estado (Abierta/Cerrada).
   - Cantidad de ventas.
   - Total de la caja.
   - Totales por medio de pago (efectivo y transferencia).
   - Indicador de cierre automático (si aplica).
3. Cada fila del listado debe ser clickeable y navegar a `/ventas/historial/[id]`.
4. La página de detalle `/ventas/historial/[id]` debe mostrar:
   - Resumen de la caja: apertura, cierre, duración, usuario que abrió, usuario que cerró, totales, cantidad de ventas, productos vendidos e insumos críticos consumidos.
   - Tabla con **todas las ventas** realizadas durante esa apertura de caja, reutilizando el estilo y la estructura del componente `SalesHistory` existente.
5. Las ventas listadas en el detalle deben mostrar: hora, productos, total, método de pago, estado y, si es activa, la acción de anular (reutilizar la funcionalidad de anulación de `SalesHistory` si es posible).
6. Si el `id` de la caja no existe, debe mostrar `notFound()`.
7. Todos los valores de fecha y hora deben formatearse con `date-fns` en español, siguiendo el patrón del detalle de caja existente (`src/app/(panel)/cierre/[id]/page.tsx`).
8. No hardcodear URLs, credenciales, valores de rango de fechas ni textos. Usar configuraciones y endpoints existentes.
9. El estilo visual debe mantenerse coherente con el resto del panel: tarjetas oscuras, bordes sutiles, tipografía `font-mono` para números y colores primarios para totales.

## Archivos existentes a tener en cuenta

- `src/app/(panel)/ventas/historial/page.tsx`: página actual de historial de ventas diarias.
- `src/app/(panel)/cierre/historial/page.tsx`: historial de cajas en la ruta `/cierre/historial`.
- `src/app/(panel)/cierre/[id]/page.tsx`: detalle de caja con resúmenes.
- `src/components/caja/caja-history.tsx`: componente cliente que lista cajas y navega a `/cierre/[id]`.
- `src/components/ventas/sales-history.tsx`: componente cliente con tabla de ventas y anulación.
- `src/components/ui/*`: componentes de shadcn/ui (Button, Card, Table, Badge, Dialog, Input, Label).
- `src/app/api/caja/historial/route.ts`: endpoint para listar cajas por rango de fechas.
- `src/app/api/caja/[id]/route.ts`: endpoint para obtener una caja con sus ventas.
- `src/application/services/cashRegisterService.ts`: contiene `getCashRegisterById` y `listCashRegisterHistory`.
- `src/repositories/cashRegisterRepository.ts`: `findById` ya incluye `sales.items.product`.
- `src/repositories/saleRepository.ts`: `findByCashRegisterId` permite filtrar por caja.
- `src/config/api.ts`: constantes de API (`CAJA_HISTORIAL_API`, `VENTAS_API`).

## Modelo de datos y relaciones relevantes

La tabla `cash_registers` ya tiene la relación con `sales`:

```typescript
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
```

`cashRegisterRepository.findById(id)` devuelve la caja con:

```typescript
{
  ...cashRegister,
  sales: {
    ...sale,
    items: {
      ...saleItem,
      product: Product
    }[]
  }[]
}
```

## Implementación detallada

### 1. Componente de listado de cajas para `/ventas/historial`

Opción A (recomendada): refactorizar `src/components/caja/caja-history.tsx` para que acepte una prop opcional `detailRoute?: string` con valor por defecto `/cierre`. Así no se duplica código y se puede reusar en `/ventas/historial` con `detailRoute="/ventas/historial"`.

Opción B: crear un componente específico `src/components/ventas/cash-register-history.tsx` que copie el comportamiento de `caja-history.tsx` pero navegue a `/ventas/historial/[id]`.

Requisitos del componente:

- Cliente (`'use client'`).
- Consultar el endpoint `/api/caja/historial` con rango de fechas de los últimos 30 días por defecto (usar `date-fns` para calcular fechas).
- Mostrar estados de carga y error.
- Cada fila debe ser clickeable y navegar a la ruta de detalle correspondiente.

### 2. Página `/ventas/historial`

Modificar `src/app/(panel)/ventas/historial/page.tsx` para que renderice el componente de listado de cajas con el título adecuado (por ejemplo, "Historial de cierres de caja").

Ejemplo de estructura:

```tsx
import { Suspense } from 'react';
import { CajaHistory } from '@/components/caja/caja-history';

export default function VentasHistorialPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        Historial de cierres de caja
      </h1>
      <Suspense fallback={<p className="text-muted-foreground">Cargando...</p>}>
        <CajaHistory detailRoute="/ventas/historial" />
      </Suspense>
    </div>
  );
}
```

### 3. Página de detalle `/ventas/historial/[id]`

Crear `src/app/(panel)/ventas/historial/[id]/page.tsx`.

Requisitos:

- Server Component (async).
- Recibir `params: Promise<{ id: string }>`.
- Llamar a `cashRegisterService.getCashRegisterById(Number(id))`.
- Si no existe, llamar a `notFound()`.
- Calcular duración con `intervalToDuration` y `formatDuration` de `date-fns` en español.
- Renderizar el resumen de caja con `Card`/`CardContent`/`CardHeader`/`CardTitle`, similar a `src/app/(panel)/cierre/[id]/page.tsx`.
- Parsear `productsSummary` y `criticalSuppliesSummary` desde JSON si están almacenados como string.
- Renderizar la tabla de ventas con el componente `SalesHistory`, pasándole `cashRegister.sales`.
- Incluir un botón "Volver al historial" que navegue a `/ventas/historial`.

Ejemplo de estructura del detalle:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, formatDuration, intervalToDuration } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SalesHistory } from '@/components/ventas/sales-history';
import * as cashRegisterService from '@/application/services/cashRegisterService';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CashRegisterSalesDetailPage({ params }: Props) {
  const { id } = await params;
  const cashRegister = await cashRegisterService.getCashRegisterById(Number(id));

  if (!cashRegister) {
    notFound();
  }

  // ... renderizar resumen y SalesHistory
}
```

### 4. Adaptación del componente `SalesHistory` si es necesario

Revisar si `SalesHistory` puede recibir las ventas devueltas por `cashRegister.sales` sin modificar su interfaz `Sale`.

Si la forma de los datos difiere, adaptar `SalesHistory` para que acepte el tipo real de las ventas de Drizzle o crear un mapeo en la página de detalle antes de pasar el array.

Si se decide que las ventas históricas no deben poder anularse desde `/ventas/historial/[id]`, crear una variante `CashRegisterSales` basada en `SalesHistory` pero sin el botón de anulación, o agregar una prop opcional `allowCancel?: boolean` a `SalesHistory`.

### 5. Actualización de navegación (opcional pero recomendado)

Si existe un menú o links que apuntan a `/ventas/historial` con el texto "Historial de ventas", actualizarlos para reflejar el nuevo propósito: "Historial de cierres de caja" o similar.

Buscar referencias con:

```bash
grep -r "/ventas/historial" src
```

## Convenciones y restricciones

- Todo el código, comentarios y mensajes de usuario deben estar en español.
- No hardcodear URLs de API. Usar constantes de `src/config/api.ts` o rutas relativas de Next.js.
- No hardcodear credenciales, secretos, rangos de fechas fijos ni textos de UI que deban ser configurables.
- Seguir el estilo visual existente del proyecto: tarjetas oscuras, bordes `border-white/8` o `border-white/10`, `font-mono` para valores numéricos, badges de estado.
- Usar componentes de shadcn/ui existentes. No instalar nuevas librerías de UI innecesarias.
- Usar `date-fns` para formateo de fechas/horas en español.
- Usar `notFound()` de Next.js para IDs inexistentes.
- Si se crean nuevos endpoints, requerir autenticación con `requireAuth()` y manejar `UnauthorizedError`.

## Verificación

Antes de dar por terminada la tarea, ejecutar:

```bash
npm run lint
npm run build
npm test
```

Si el proyecto tiene tests E2E relevantes, ejecutar también:

```bash
npx playwright test
```

Comprobar manualmente:

1. Acceder a `/ventas/historial` y verificar que se listan las cajas.
2. Hacer clic en una caja cerrada y verificar que `/ventas/historial/[id]` muestra el resumen y todas las ventas.
3. Hacer clic en una caja abierta y verificar que se muestra "En curso" como duración y las ventas acumuladas hasta el momento.
4. Ingresar un ID inexistente y verificar que aparece la página 404.
5. Verificar que la acción de anular venta funciona correctamente desde el detalle (si se habilitó) o que se muestra correctamente el estado de las ventas anuladas.

## Entregables esperados

- `src/app/(panel)/ventas/historial/page.tsx` actualizado.
- `src/app/(panel)/ventas/historial/[id]/page.tsx` creado.
- Componente de listado reutilizable o adaptado (`src/components/caja/caja-history.tsx` o `src/components/ventas/cash-register-history.tsx`).
- `SalesHistory` adaptado si fue necesario para soportar las ventas de caja o anulación condicional.
- Ningún hardcodeo de URLs, credenciales o valores sensibles.
- Código con lint, build y tests pasando.
