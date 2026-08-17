# Prompt: Auditoría, depuración y corrección de la sección de pedidos — cliente y panel

## Contexto

Proyecto: `pancheria` — Sistema multi-sucursal de gestión de stock, ventas, caja y pedidos públicos por WhatsApp.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pedidos-publicos-sucursal-y-stock.md" />
- <ref_file file="C:/developer/paginas/pancheria/README.md" />

## Estado actual relevante

La sección de pedidos tiene dos caras:

- **Cliente**: ruta pública `/pedido` que consume `src/app/(public)/pedido/page.tsx` y `src/components/pedido/pedido-client.tsx`. El cambio de sucursal mediante el `<Select>` del encabezado no funciona correctamente: al cambiar de sucursal se actualiza la URL y se recarga el catálogo, pero el carrito (`useCart`) no se invalida ni se reinicia con el nuevo `branchId`, lo que puede llevar a reservar productos de la sucursal anterior bajo el `branchId` de la nueva. <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="141-147" /> <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="261-268" />

- **Panel**: rutas `/pedidos` e `/pedidos/[id]` que usan `src/components/pedidos/pedidos-list.tsx` y `src/components/pedidos/pedido-detail.tsx`, y las APIs `src/app/api/pedidos/*`. Los pedidos se filtran por la sucursal del usuario autenticado (`getCurrentBranchId`).

Además, existen inconsistencias y duplicación entre el flujo de creación de pedidos (`orderService.createOrder`) y la conversión a venta (`orderService.convertOrderToSale` vs `saleService.confirmSale`).

## Objetivo

Auditar, depurar y corregir toda la sección de pedidos (cliente y panel/operador/administrador), eliminando errores, inconsistencias, duplicación de código y bloques obsoletos. En particular, el **cambio de sucursal del lado del cliente debe funcionar de forma consistente**, invalidando el carrito y mostrando el catálogo de la sucursal seleccionada.

## Reglas de negocio

1. El catálogo público es siempre por una única sucursal activa.
2. El cliente puede elegir sucursal solo si existe más de una; si no, se muestra el nombre de la única.
3. Al cambiar de sucursal en `/pedido`:
   - Se actualiza el query param `?branchId=<id>`.
   - Se persiste la elección en `localStorage` (`pancheria-branch-id`).
   - Se invalida y limpia el carrito (`pancheria-cart-v1`) si pertenecía a otra sucursal.
   - Se recarga el catálogo con disponibilidad de la nueva sucursal.
   - El pedido creado reserva stock de la sucursal seleccionada.
4. Un pedido reserva stock transaccionalmente; al confirmar como venta no se descuenta stock nuevamente; al cancelar se reintegra.
5. Los administradores/operadores ven solo los pedidos de su sucursal activa.
6. Un operador solo ve pedidos de su sucursal asignada; un administrador puede cambiar de sucursal en el panel y ver los pedidos de la sucursal activa.
7. No se deben generar hydration mismatches en componentes cliente.

## Implementación detallada

### Cliente (`/pedido`)

- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />
  - Validar que `searchParams.branchId` sea un número entero positivo antes de usarlo; redirigir o mostrar error si no.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
  - Corregir `handleBranchChange` para que invalide/limpie el carrito antes de `router.push`.
  - Asegurar que `useCart` se reinicialice o descarte el carrito anterior cuando `branchId` cambia.
  - Revisar el `useEffect` de carga inicial para evitar renders intermedios con sucursal mixta.
  - Sincronizar el estado `branch` con `activeBranch` cuando cambian las props del Server Component.
  - Revisar la validación de disponibilidad del carrito: el campo `productIds` enviado al endpoint parece redundante. <ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="216-229" />
- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />
  - Asegurar que, si cambia `branchId`, el carrito se descarte (no se guarde con el nuevo `branchId` productos de la sucursal anterior).
  - Inicializar `items` considerando `branchId` y limpiar `localStorage` si no coincide.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />
  - Revisar el uso de `useSyncExternalStore` con subscribe vacío; reemplazar por patrón `useState/useEffect` para resolver `mounted` y evitar hydration mismatch.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" />
  - Verificar que muestre correctamente la sucursal del pedido.

### Backend (APIs y servicios)

- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" />
  - Revisar resolución de `branchId` y consistencia con `getDefaultBranchId`.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/disponibilidad/route.ts" />
  - Revisar si `productIds` es necesario en el schema y servicio.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />
  - Revisar rate limiting, validación de sucursal, generación de mensaje WhatsApp.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/cancelar/route.ts" />
  - Verificar que el token de cancelación se valide y que la sucursal corresponda.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />
  - <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="91-119" /> y <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="120-249" />
  - Revisar `buildProductContext` y `createOrder` por duplicación con `saleService`.
  - La validación `product.branchId !== branchId` es redundante si `productRepository.findByIds` ya filtra por `branchId`; decidir si mantener defensa en profundidad.
  - Reusar `confirmSale` en `convertOrderToSale` o extraer lógica común.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />
  - <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="209-361" />
  - Revisar `validateCartAvailability`: el parámetro `productIds` puede causar cálculo de disponibilidad para productos no en el carrito; simplificar o documentar.
  - Revisar `calculateCompoundAvailability` y `buildBreakdown` para evitar duplicación con `summaryService`.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.ts" />
  - Verificar que `listPublicCatalogWithAvailability` incluya el `branch` correcto y que los productos sean de la sucursal indicada.

### Panel (`/pedidos`)

- <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/pedidos/page.tsx" />
  - Verificar que reciba/derive correctamente la sucursal activa.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" />
  - Verificar que el listado se actualice al cambiar de sucursal en el panel.
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />
  - Verificar que la confirmación requiera caja abierta y maneje idempotencia.
  - Verificar que el detalle muestre la sucursal del pedido.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/confirmar/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/cancelar/route.ts" />
  - Revisar consistencia de autorización y filtrado por sucursal.

### Tests

- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido-sucursal-y-stock.spec.ts" />
  - Corregir el test de cambio de sucursal para que realmente cambie de default a second, agregue un producto en second y valide que el catálogo cambia.
  - Agregar test de limpieza de carrito al cambiar de sucursal.
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido.spec.ts" />
  - Extender para cubrir pedido en sucursal no default.
- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.test.ts" />
  - Agregar test de invalidación de carrito al cambiar de `branchId` en tiempo de ejecución.
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" />
  - Agregar tests de cambio de sucursal en pedidos, pedido de producto de otra sucursal, cancelación pública con token.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API ni nombres de sucursal.
- Ejecutar `npm run test:e2e` y `npx tsx src/db/seeds.ts` solo en base de datos de prueba (ver `AGENTS.md`).
- No commitear `.env.local`.
- Cualquier cambio en `src/db/schema.ts` requiere `npx drizzle-kit generate` y `npx drizzle-kit push`.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba |

## Entregables

1. Código corregido para cambio de sucursal en `/pedido` con limpieza de carrito y recarga correcta del catálogo.
2. Corrección de duplicaciones e inconsistencias entre `orderService` y `saleService`.
3. Corrección de hydration mismatch en `ProductCard`.
4. Tests E2E actualizados y nuevos tests unitarios para el cambio de sucursal.
5. Informe breve de hallazgos y decisiones tomadas (agregar a `.devin/informes/lecciones-aprendidas.md` si aplica).
