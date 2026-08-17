# Prompt: Sucursal y stock explícitos en pedidos públicos

## Contexto

Proyecto: `pancheria` — Sistema de gestión multi-sucursal de stock, ventas, productos, recetas, caja, cierre diario y pedidos públicos por WhatsApp.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

## Estado actual relevante

El catálogo público (`/pedido`) y las APIs públicas (`/api/public/catalogo`, `/api/public/disponibilidad`, `/api/public/pedido`) ya funcionan con `branchId` por query param o con `DEFAULT_BRANCH_NAME`. El pedido reserva stock transaccionalmente y el mensaje de WhatsApp se genera correctamente. Sin embargo, la interfaz pública no muestra selector de sucursal, no indica a qué sucursal pertenece el catálogo ni qué stock se consume, y el seed no replica el catálogo a una segunda sucursal opcional.

## Objetivo

Hacer que el flujo de pedidos públicos sea multi-sucursal consciente: el cliente debe poder elegir la sucursal, ver claramente a cuál pertenece el catálogo, entender de dónde sale la disponibilidad mostrada, y que el pedido reserve el stock correcto de la sucursal seleccionada.

## Reglas de negocio

1. El catálogo público es siempre por **una única sucursal activa**.
2. Si existe más de una sucursal, `/pedido` debe mostrar un selector de sucursal visible.
3. Si solo existe una sucursal, se selecciona automáticamente y se muestra su nombre, sin selector.
4. La sucursal seleccionada se resuelve con el siguiente orden de prioridad:
   1. Query param `?branchId=<id>`.
   2. `localStorage` (`pancheria-branch-id`) si existe y es válido.
   3. Sucursal por defecto (`DEFAULT_BRANCH_NAME`).
   Si no hay query param, el Server Component redirige a `?branchId=<id>` con el valor resuelto para que la URL sea compartible.
   La sucursal seleccionada se refleja en:
   - Query param `?branchId=<id>`.
   - `localStorage` para recordar la última elección del cliente.
   - Título o encabezado del catálogo.
   - Mensaje de WhatsApp enviado al hacer el pedido.
   - Detalle del pedido en el panel.
5. La disponibilidad mostrada en el catálogo debe corresponder **estrictamente al stock de la sucursal seleccionada**:
   - `critical_supply` tipo `beverage`: stock directo del producto en esa sucursal.
   - `compound` (promos): mínimo de `stock / cantidad` de cada insumo crítico con `autoDiscount=true` de esa sucursal.
   - `service`: sin límite.
6. Las promos deben ofrecer un tooltip con el desglose de todos los insumos que la componen (stock disponible, requerido y cuál limita la disponibilidad). Este desglose se expone como `breakdownByProduct` en la respuesta de disponibilidad, diferenciándolo de `shortageByProduct` que ya indica el insumo limitante cuando falta stock.
7. Al crear un pedido se reserva stock de la sucursal seleccionada; la reserva se libera si se cancela y no se vuelve a descontar al confirmar como venta.
8. El tipo de entrega `pickup` implica retiro en la sucursal seleccionada; el mensaje de WhatsApp debe incluir el nombre de esa sucursal.
9. El seed (`src/db/seeds.ts`) debe copiar el catálogo base a la sucursal opcional (`NEW_BRANCH_NAME`) cuando esté configurada, para que el catálogo de esa sucursal no quede vacío.
10. No se deben generar hydration mismatches en `ProductCard`: el estado `inCart` debe resolverse de forma consistente entre SSR y cliente.

## Implementación detallada

### Backend

#### `src/lib/branch-resolver.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-resolver.ts" />
- Agregar `listPublicBranches()` que devuelva `{ id, name }` de todas las sucursales activas, ordenadas por nombre o `createdAt`.
- Mantener `getDefaultBranchId()` para el fallback.

#### `src/app/api/public/catalogo/route.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/catalogo/route.ts" />
- Asegurar que `branchId` se resuelva correctamente y que la respuesta incluya el **nombre de la sucursal** junto con la lista de productos.
- Tipo de respuesta: `{ branch: { id, name }, products: PublicCatalogProduct[] }`.

#### `src/application/services/catalogService.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/catalogService.ts" />
- Agregar `getPublicBranch(branchId)` y ajustar `listPublicCatalogWithAvailability` para que la respuesta pública incluya información de la sucursal.
- Considerar `PublicCatalogResponse = { branch: Branch; products: PublicCatalogProduct[] }`.

#### `src/app/api/public/disponibilidad/route.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/disponibilidad/route.ts" />
- Mantener validación contra `branchId`.
- Extender el resultado para devolver, por cada producto `compound`, el desglose de insumos con su stock requerido, disponible y limitante.

#### `src/application/services/saleService.ts`
- <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="120-286" />
- Extender `validateCartAvailability` para retornar, además de `shortageByProduct` y `availabilityByProduct`, un `breakdownByProduct` que, para cada promo, liste todos sus insumos críticos con stock disponible, requerido y una marca `isLimiting` en el insumo que limita la disponibilidad. No duplicar `shortageByProduct`, que sigue representando la falta de stock.
- Asegurar que todas las consultas filtran por `branchId`.

#### `src/application/services/orderService.ts`
- <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" lines="120-248" />
- Mantener la validación de que todos los productos pertenecen a `branchId`.
- Asegurar que `createOrder` falle con `NotFoundError` si la sucursal no existe.
- Incluir `branch` en el retorno para poder mostrar el nombre en el panel y en el mensaje de WhatsApp.

#### `src/lib/whatsapp.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.ts" />
- Extender `PublicOrder` con `branchName?: string`.
- Incluir la sucursal en el mensaje generado cuando `deliveryType === 'pickup'` o siempre como referencia del local.

#### `src/db/seeds.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/db/seeds.ts" />
- Al crear la sucursal opcional (`NEW_BRANCH_NAME`), si no tiene productos, copiar el catálogo base (productos, recetas y stock inicial) desde la sucursal por defecto a la nueva.
- Asegurar que los IDs de productos sean nuevos y las recetas apunten a los nuevos IDs dentro de la misma sucursal.

### Frontend

#### `src/app/(public)/pedido/page.tsx`
- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />
- Responder a `branchId` en `searchParams`.
- Si no viene, usar `getDefaultBranchId()` y redirigir a `?branchId=<id>` para que la URL sea compartible.
- Pasar la lista de sucursales y la sucursal activa a `PedidoClient`.

#### `src/components/pedido/pedido-client.tsx`
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- Recibir `branches: Branch[]` y `activeBranch: Branch` como props.
- Mostrar un `Select` de sucursal si `branches.length > 1`; caso contrario mostrar el nombre de la única sucursal.
- Al cambiar de sucursal:
  - Guardar el `branchId` elegido en `localStorage` (`pancheria-branch-id`).
  - Navegar a `?branchId=<id>` con `router.push('/pedido?branchId=' + id)` para que el Server Component vuelva a cargar el catálogo correspondiente.
  - Limpiar el carrito si la sucursal cambia (evitar productos de otra sucursal); la recarga del catálogo hace que `useCart` se reinicialice con la nueva sucursal.
- Mostrar el nombre de la sucursal activa en el encabezado del catálogo.
- Incluir el nombre de la sucursal en el checkout (`Retiro en sucursal: <nombre>`).
- Incluir `branchName` en el cuerpo del pedido enviado a la API pública.
- Corregir el manejo de `isMountedRef` siguiendo la guía de `AGENTS.md`.

#### `src/components/pedido/product-card.tsx`
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/product-card.tsx" />
- Mostrar la disponibilidad con unidad (`Disponible: 5 unidades`).
- Para `compound`, agregar un tooltip o texto colapsable que muestre el desglose de insumos y el limitante.
- Resolver el hydration mismatch: agregar una bandera `mounted` en `ProductCard` (inicializar en `false` y activar en `useEffect`) para evitar mostrar el estado `inCart` durante el primer render. El label del botón debe ser consistente entre SSR y cliente.

#### `src/hooks/useCart.ts`
- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />
- Al detectar cambio de `branchId`, invalidar el carrito guardado si pertenecía a otra sucursal.
- Mantener la versión `pancheria-cart-v1` con `branchId`.

#### `src/components/pedido/cart-summary.tsx`
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/cart-summary.tsx" />
- Mostrar la sucursal del pedido en el resumen del carrito.
- Confirmar que el botón `Pedir por WhatsApp` abre el checkout.

#### `src/components/pedidos/pedido-detail.tsx`
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />
- Mostrar el nombre de la sucursal del pedido en el detalle.
- Mostrar el tipo de entrega con la sucursal de retiro cuando corresponda.

### Tests

#### Tests unitarios
- `src/app/api/public/catalogo/route.test.ts`: validar que la respuesta incluye `branch`.
- `src/application/services/catalogService.test.ts`: validar `listPublicCatalogWithAvailability` con disponibilidad por sucursal.
- `src/hooks/useCart.test.ts`: validar que el carrito se invalida al cambiar de sucursal.
- `src/components/pedido/product-card.test.tsx`: validar que no hay hydration mismatch y que se muestra el desglose de insumos.

#### Tests E2E (`tests/e2e/`)
- Extender `tests/e2e/pedido.spec.ts` para:
  - Navegar a `/pedido`, cambiar de sucursal si hay más de una.
  - Verificar que el catálogo muestra productos de la sucursal seleccionada.
  - Verificar que el nombre de la sucursal aparece en el catálogo y en el checkout.
  - Realizar un pedido y verificar que el mensaje de WhatsApp incluye el nombre de la sucursal.
- Crear `tests/e2e/pedido-sucursal-y-stock.spec.ts` con flujos de:
  - Pedido en sucursal default.
  - Pedido en sucursal no default.
  - Cancelación de pedido y reintegro de stock en la sucursal correcta.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de API ni nombres de sucursal. El nombre de la sucursal default debe seguir viniendo de `DEFAULT_BRANCH_NAME`.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` sigue siendo obligatorio para generar el enlace de WhatsApp.
- Ejecutar `npx tsx src/db/seeds.ts` y `npm run test:e2e` **solo en base de datos de prueba**, ya que truncan o modifican datos.
- No commitear `.env.local`.
- Cualquier cambio en `src/db/schema.ts` requiere `npx drizzle-kit generate` y `npx drizzle-kit push` en la base de destino.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npx drizzle-kit check` | Consistencia del esquema |
| `npm run test:e2e` | Tests E2E en base de prueba (requiere confirmación) |

## Entregables

1. Selector de sucursal en `/pedido` con persistencia en URL y `localStorage`.
2. Visualización del nombre de sucursal en catálogo, checkout, mensaje de WhatsApp y panel.
3. Desglose de disponibilidad para promos (`compound`).
4. Seed que replica el catálogo base a la sucursal opcional.
5. Corrección del hydration mismatch en `ProductCard`.
6. Tests unitarios y E2E actualizados.
7. Actualización de `pancheria.prompt.md` y `reporte-estado.md` si corresponde.
