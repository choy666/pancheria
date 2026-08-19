# Prompt: Recomendaciones y buenas prácticas para pedidos, sucursales y stock

## Contexto

Proyecto: `pancheria` — Sistema multi-sucursal de gestión de stock, ventas, caja y pedidos públicos por WhatsApp.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Este prompt documenta las decisiones arquitectónicas y las buenas prácticas aprendidas durante la auditoría del flujo de pedidos públicos y del panel de pedidos. Antes de tocar cualquiera de estos archivos, leer:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />

## 1. Aislamiento por sucursal

### Regla general
- Tratar `branchId` como **parte del estado de navegación**, no solo como dato de sesión.
  - En `/pedido` la URL (`?branchId=<id>`) es la fuente de verdad.
  - En el panel (`/pedidos`, `/ventas`, etc.) la sucursal activa se obtiene de la cookie o de `getCurrentBranchId(session)`.
- Cualquier Client Component que dependa de la sucursal debería recibirla como prop o reaccionar a su cambio.

### Implementación concreta
- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" /> valida y resuelve `branchId`, y envuelve la carga del catálogo en `Suspense` mediante el componente asíncrono `PedidoCatalog`.
- `PedidoCatalog` (definido en <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />) carga `branches` e `initialProducts` dentro de `Suspense` para mostrar `PedidoSkeleton` mientras se resuelven.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> recibe `activeBranch` y `initialProducts`; al cambiar de sucursal limpia el carrito y navega.
- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/page.tsx" /> obtiene la sucursal activa en el Server Component y se la pasa a <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />.

### Evitar que el carrito sobreviva a un cambio de sucursal
La invalidez del carrito se defiende en tres puntos:

1. **Estado React**: `handleBranchChange` llama `clearCart()` antes de `router.push`.
2. **Remonte limpio**: `PedidoCatalog` (en `pedido/page.tsx`) renderiza `PedidoClient` con `key={branchId}`, por lo que React remonta el componente al cambiar de sucursal.
3. **Persistencia**: <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" /> valida `stored.data.branchId` en `getInitialItems` y descarta el carrito si no coincide.

## 2. Hydration y Client Components

### Evitar hydration mismatch en props que dependen de `localStorage`
- Si un Client Component recibe una prop que solo se conoce en el cliente (por ejemplo, el carrito que se hidrata desde `localStorage`), el servidor y el cliente pueden renderizar contenido diferente y causar un error de hydration.
- La raíz del problema suele estar en leer `localStorage` durante el render, por ejemplo en el inicializador de `useState`. En su lugar, inicializar el estado con un valor seguro para SSR (como un arreglo vacío) y cargar el valor real en un `useEffect`.
- En <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" /> el carrito inicia vacío y se hidrata desde `localStorage` dentro de un `useEffect`. De ese modo `PedidoClient`, `ProductCard` y `CartSummary` reciben `items = []` tanto en el servidor como en el primer render del cliente, eliminando el mismatch.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" /> usa la prop `inCart` directamente para decidir entre `Agregar` y `Agregar otro`; no necesita `useSyncExternalStore` ni flags de montaje.

### `setState` dentro de `useEffect`
El proyecto permite `setState` en efectos en dos casos concretos:

1. **Carga asíncrona con flag de montaje.** Usar `isMountedRef` o una bandera `cancelled` dentro del `useEffect`, retornar una función de cleanup que evite actualizaciones luego del desmontaje, y no llamar `setState` si el componente ya no está montado.
2. **Persistencia derivada.** Escribir en `localStorage` u otro almacenamiento local como consecuencia de un cambio de estado (por ejemplo, guardar el carrito cuando cambian los ítems).

Para **sincronizar props con estado**, preferir:

1. **Calcular valores directamente** en render si no necesitan mutar.
2. **Usar `key` para forzar remonte** cuando la prop define un nuevo contexto completo (como `branchId`).
3. **Levantar el estado al padre** si varios componentes comparten la misma fuente de verdad.

### Ejemplos aplicados
- `PedidoClient` carga el catálogo asíncronamente en un `useEffect` con `isMountedRef` y actualiza `products` (carga inicial y refresco periódico); `activeBranch` se sincroniza vía `key={branchId}`, no por efecto.
- `useCart` inicia con un carrito vacío (SSR-safe), persiste el carrito en `localStorage` en un `useEffect` y lo hidrata en otro `useEffect` cuando cambia `branchId`.
- `ProductCard` usa la prop `inCart` directamente para mostrar `Agregar` o `Agregar otro`; el mismatch desaparece porque `useCart` no lee `localStorage` durante el render.

## 3. Consolidación de lógica de ventas y pedidos

### Principio
`orderService.ts` y `saleService.ts` comparten validación de productos, cálculo de totales, inserción de venta, resumen de caja y manejo de stock. Duplicar estos pasos es riesgoso:

- `convertOrderToSale` no debe descontar stock dos veces.
- `confirmSale` no debe omiter validaciones de productos vendibles.

### Helpers comunes extraídos
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> — `validateProductsForOperation`.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> — `buildSaleItemValues`.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> — `insertSaleAndUpdateCashRegister`.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> — `buildReintegrationContext` y `reintegrateStockAndUpdateCashRegister` para `cancelSale`. `cancelOrder` no modifica stock porque los pedidos `pending` no reservan.

### Semántica de disponibilidad
- En `/pedido` solo interesa la disponibilidad de los items del carrito.
- En `/ventas` el terminal necesita la disponibilidad de **todo el catálogo** para mostrar mensajes como `En este pedido: X más`.
- Por eso <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" /> mantiene `validateCartAvailability(branchId, items, productIds?)` con el parámetro `productIds` opcional.

## 4. Tests y confianza

### Selectores estables
- Preferir `data-testid` sobre selectores de estructura (`locator('..')`, `getByRole` con textos dinámicos, etc.).
- Ejemplos del flujo de pedidos:
  - `data-testid={`product-card-${product.id}`}` en `ProductCard`.
  - `data-testid={`add-product-${product.id}`}` en el botón.
  - `data-testid={`cart-item-${item.id}`}` en `CartSummary`.

### Iteración rápida con E2E
- Correr tests enfocados antes de la corrida completa:
  ```bash
  npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts
  ```
- Esto acelera el feedback y evita esperar toda la suite.

### Documentar tests preexistentes fallidos
- Si una corrida completa deja fallos que parecen preexistentes (seed duplicado, datos residuales, selectores ambiguos), anotarlos en <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> o en un issue.
- Esto evita que se confundan con regresiones del flujo de pedidos.

## 5. Proceso de cambios futuros

### Antes de modificar
1. Consultar `AGENTS.md`, `.devin/informes/lecciones-aprendidas.md` y los prompts relevantes.
2. Identificar si la lógica afectada está duplicada entre `orderService` y `saleService`.
3. Revisar si `validateCartAvailability` o `buildSaleItemValues` cambian de firma; de ser así, actualizar consumidores y tests.

### Verificaciones inmediatas
Después de editar servicios u hooks, correr:

```bash
npx tsc --noEmit
npm run lint
```

Antes de `npm test`. Los errores de tipo por cambios de firma aparecen más rápido y evitan tests con mocks inconsistentes.

### Limpieza del árbol de trabajo
- No commitear cambios en prompts o documentación que no correspondan a la tarea.
- Si un prompt fue archivado o reemplazado, resolver el estado en un commit separado.
- No commitear `.env.local`.

## 6. Seguridad y configuración

- No hardcodear credenciales, URLs de API ni nombres de sucursal.
- Las variables sensibles deben provenir de `.env.local` o de variables de entorno.
- `DATABASE_URL` de producción debe apuntar a Neon/Vercel Postgres, no a `localhost`, para que el seed y las migraciones se comporten igual que en desarrollo.
- Ejecutar `npm run test:e2e` y `npx tsx src/db/seeds.ts` solo en base de datos de prueba.

## Verificaciones mínimas

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y reglas de React Hooks |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts` | Tests E2E enfocados del flujo de pedidos |
| `npm run test:e2e` | Tests E2E completos en base de prueba |

## Resumen

La arquitectura de pedidos quedó cohesionada al:

- Aislar catálogo, carrito y pedidos por `branchId`.
- Limitar `setState` en efectos a carga asíncrona con flag de montaje y persistencia derivada; evitarlo para sincronización de props con estado.
- Reutilizar helpers entre `orderService` y `saleService`.
- Agregar `data-testid` estables para E2E.
- Documentar decisiones en `lecciones-aprendidas.md`.

El próximo paso recomendado es estabilizar los tests E2E preexistentes que fallan por duplicados de seed o selectores ambiguos, para que `npm run test:e2e` sea una puerta de calidad confiable.
