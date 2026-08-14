# Prompt: Catálogo público de productos y pedidos por WhatsApp

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado-2026-08-13.md" />
- <ref_file file="C:/developer/paginas/pancheria/src/auth.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/api-handler.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/db-errors.ts" />

## Estado actual relevante

El sistema administra productos con soft delete, tipos (`critical_supply`, `compound`, `manual_supply`, `service`), recetas y disponibilidad. <ref_snippet file="C:/developer/paginas/pancheria/src/components/ventas/sales-terminal.tsx" lines="33-39" /> define qué productos son vendibles. <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="61-113" /> calcula disponibilidad por producto y <ref_snippet file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" lines="115-281" /> valida un carrito considerando insumos compartidos. El panel de administración y operador está completo; ahora se quiere una cara pública, sin usuarios ni roles, que permita a cualquier cliente armar un pedido y finalizarlo vía WhatsApp para que un humano confirme pago, envío o retiro.

<ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="72-107" />
<ref_snippet file="C:/developer/paginas/pancheria/src/lib/product-style.ts" lines="1-55" />
<ref_snippet file="C:/developer/paginas/pancheria/src/lib/money.ts" lines="1-49" />

## Objetivo

Crear una ruta pública `/pedido` accesible sin autenticación donde cualquier persona pueda:

1. Ver los productos que el administrador puede vender, filtrados por una sucursal.
2. Armar un carrito simple, práctico y persistente en el dispositivo.
3. Finalizar el pedido y ser redirigido a WhatsApp con un mensaje pre-armado que un humano recibirá para corroborar pago, dirección de envío o retiro.

El flujo debe mantener el diseño minimalista, futurista, óptimo y eficaz del panel, y debe estar pensado para escalar a futuro (múltiples sucursales, autenticación de clientes, pedidos persistidos, pagos, etc.).

## Reglas de negocio

1. **Ruta pública, sin roles ni usuarios**: `/pedido` no debe requerir `NextAuth` ni `PanelHeader`. Cualquier visitante puede entrar.
2. **Sucursal por defecto**: el catálogo muestra los productos de una sucursal configurable. Si no se especifica `branchId`, se resuelve en el servidor la sucursal cuyo nombre coincida con `DEFAULT_BRANCH_NAME`. No exponer el `branchId` interno en la respuesta pública.
3. **Productos vendibles**: mostrar solo productos que cumplan `isActive = true`, `deletedAt is null` y la misma regla de vendibilidad de la terminal:
   - `compound` (promos)
   - `service`
   - `critical_supply` con `criticalSupplyType === 'beverage'`
4. **Disponibilidad real**: la lista de productos calcula disponibilidad con `saleService.calculateAvailabilityForProductIds`. El carrito valida disponibilidad considerando insumos compartidos con `saleService.validateCartAvailability`. Si un producto tiene disponibilidad menor o igual a cero (y no es `service`), mostrarlo como agotado y no permitir agregarlo.
5. **Carrito en cliente**: persistir en `localStorage`, soportar agregar, quitar y cambiar cantidades. Validar disponibilidad antes de aumentar cantidad y al finalizar el pedido.
6. **Checkout simple**: al finalizar se abre un `Dialog` con:
   - Nombre del cliente (obligatorio)
   - Tipo de entrega: "Envío a domicilio" o "Retiro en sucursal"
   - Dirección (obligatoria solo si es envío)
   - Notas opcionales
7. **WhatsApp manual**: no se registra venta en el sistema. Se genera un enlace `https://wa.me/<numero>?text=<mensaje>` con el resumen del pedido, total, datos del cliente, tipo de entrega y notas. El número de WhatsApp debe incluir el código de país completo y venir de `process.env.NEXT_PUBLIC_WHATSAPP_NUMBER` (sin espacios, sin el signo `+`).
8. **Sin hardcodeos**: número de WhatsApp, textos del mensaje y el intervalo de refresco deben leerse de variables de entorno `NEXT_PUBLIC_*` cuando el cliente las necesite. La sucursal por defecto se resuelve en el servidor a partir de `DEFAULT_BRANCH_NAME` (ya existe en `.env.example`; no es `NEXT_PUBLIC`). Los fallbacks en español viven en `src/config/catalog.ts`.
9. **No exponer datos sensibles**: la API pública devuelve un DTO `PublicCatalogProduct` con `id`, `name`, `description`, `type`, `criticalSupplyType`, `price`, `unit` y `availability` solamente. No debe devolver `branchId`, `stock` crudo, `minStock`, costos, recetas, fechas internas, ni productos de otra sucursal ni eliminados/inactivos.
10. **Diseño consistente**: reutilizar los estilos de tipo de producto de `src/lib/product-style.ts`, los colores oscuros, la tipografía monoespaciada para precios y los componentes de shadcn/ui (`Card`, `Button`, `Badge`, `Dialog`).

## Implementación detallada

### Configuración

Crear `src/config/catalog.ts`:
- `getWhatsAppNumber()`: lee `NEXT_PUBLIC_WHATSAPP_NUMBER`, limpia espacios y signo `+`, y valida que sea numérico.
- `getWhatsAppMessageParts()`: devuelve saludo y cierre por defecto en español; permite sobreescribir con `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` y `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING`.
- `getPedidoRefetchIntervalMs()`: lee `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` con default 30000.
- No acceder a la base de datos desde este archivo; es solo lectura de variables de entorno.

Crear `src/lib/branch-resolver.ts` (o resolver dentro de `catalogService`):
- `getDefaultBranchId()`: en el servidor, busca en `branchService.listBranches()` la sucursal cuyo nombre coincida con `DEFAULT_BRANCH_NAME` y devuelve su `id`. Si no se encuentra, arrojar un error claro. No leer variables `NEXT_PUBLIC_*` aquí.

Crear `src/lib/catalog.ts`:
- `isPublicSellableProduct(product)`: extraer la lógica de vendibilidad desde `sales-terminal.tsx` (líneas 33-39) para reutilizarla en la API, el cliente y los tests. La firma debe aceptar un objeto con al menos `{ type, criticalSupplyType }`. Actualizar `sales-terminal.tsx` para importar esta función y eliminar la duplicación.
- `groupPublicProductsByType(products)`: reutilizar `groupProductsByType` de `src/lib/product-grouping.ts`, pasando `typePriority` y `criticalSupplyTypePriority` de `src/lib/product-style.ts`.

Actualizar `src/config/routes.ts`:
- Agregar `pedido: '/pedido'`.

Actualizar `.env.example`:
- `NEXT_PUBLIC_WHATSAPP_NUMBER=` (número completo con código de país, sin `+` ni espacios)
- `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS=30000`
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING=` (opcional)
- `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING=` (opcional)
- Mantener `DEFAULT_BRANCH_NAME` ya existente (no agregar prefijo `NEXT_PUBLIC_`).

### Backend

Crear `src/repositories/catalogRepository.ts` (o wrapper de `productRepository`):
- `findPublicProducts(branchId)`: productos activos, no eliminados, vendibles, ordenados por nombre. No calcular disponibilidad aquí; eso es responsabilidad del servicio.

Crear `src/application/services/catalogService.ts`:
- Definir el tipo `PublicCatalogProduct = Pick<ProductRow, 'id' | 'name' | 'description' | 'type' | 'criticalSupplyType' | 'price' | 'unit'> & { availability: number }`.
- `listPublicCatalog(branchId)`: devuelve productos activos, no eliminados y vendibles, ordenados por nombre, mapeados a `PublicCatalogProduct` con `availability: 0`.
- `listPublicCatalogWithAvailability(branchId)`: igual pero calcula disponibilidad con `saleService.calculateAvailabilityForProductIds` y mapea a `PublicCatalogProduct` incluyendo `availability`.
- `validatePublicCart(branchId, items)`: expone `saleService.validateCartAvailability` para validar el carrito desde el cliente (sin sesión).
- Validar que `branchId` exista; de lo contrario devolver `NotFoundError` (404) o `ValidationError` (400).
- No requerir sesión.

Crear `src/app/api/public/catalogo/route.ts`:
- `GET /api/public/catalogo?branchId=<id>&includeAvailability=true`
- No usar `requireAuth`. Leer `branchId` del query, validarlo con Zod (`z.coerce.number().int().positive()`), caer a sucursal por defecto si no se envía.
- En caso de error de conexión a base de datos, devolver 503 siguiendo el patrón del proyecto.
- En caso de sucursal inexistente, devolver 404.
- Responder con el DTO `PublicCatalogProduct[]`; nunca devolver `ProductRow` completo.

Crear `src/app/api/public/disponibilidad/route.ts`:
- `POST /api/public/disponibilidad?branchId=<id>`
- No usar `requireAuth`. Validar el body con `cartAvailabilitySchema` (o un schema público equivalente) usando Zod.
- Invocar `catalogService.validatePublicCart(branchId, items)`.
- Devolver `{ availabilityByProduct, shortageByProduct }` para que el cliente ajuste cantidades.
- En caso de error de conexión, devolver 503.

Crear `src/lib/whatsapp.ts`:
- Definir el tipo `PublicOrder` con ítems, datos del cliente, tipo de entrega, dirección, notas y total.
- `buildWhatsAppMessage(order)` con firma clara.
- `encodeWhatsAppUrl(phone, message)` generando `https://wa.me/{phone}?text={encodedMessage}`.
- Incluir líneas del pedido, total, nombre, tipo de entrega, dirección y notas.
- Usar `moneyToNumber` y `toFixed(2)` para formatear precios en el mensaje de texto.

### Frontend

Crear `src/app/(public)/layout.tsx`:
- Sin `PanelHeader`, sin `auth()`. Header simple con branding "Panchería" y link a login (`/login`) opcional para el staff.
- Mantener el fondo oscuro y la tipografía del layout raíz.

Crear `src/app/(public)/pedido/page.tsx`:
- Server Component que lea `searchParams.branchId`, resuelva la sucursal por defecto, llame al servicio y pase productos iniciales.
- Usar `Suspense` y skeletons.

Crear `src/components/pedido/pedido-client.tsx`:
- Client Component con el estado del carrito, la carga de disponibilidad y el modal de checkout.
- Usar `useRef` para evitar `setState` tras desmontaje, siguiendo el patrón de `AGENTS.md`.
- Implementar polling opcional de disponibilidad cada `NEXT_PUBLIC_PEDIDO_REFETCH_INTERVAL_MS` usando `GET /api/public/catalogo?includeAvailability=true` para la lista y `POST /api/public/disponibilidad` cuando el carrito cambia.
- Validar el carrito con `validatePublicCart` antes de generar el enlace de WhatsApp.

Crear `src/hooks/useCart.ts`:
- Estado interno de `useState` inicia vacío (o desde props) para evitar problemas de hidratación SSR.
- `useEffect` al montar lee `localStorage` key versionada `pancheria-cart-v1` (schema Zod) y, si la sucursal del carrito no coincide con la actual, limpia el carrito.
- `useEffect` persiste en `localStorage` cuando cambian los ítems.
- Funciones `addItem`, `removeItem`, `updateQuantity`, `clearCart`.
- Validar cantidades contra `availability` pasada como parámetro o función `getAvailability`; para productos `service` no aplicar límite.

Crear `src/components/pedido/product-card.tsx`:
- Tarjeta con nombre, descripción, tipo, precio, disponibilidad y botón de agregar.
- Estados: agotado, agregado, etc.
- Colores y badges de `src/lib/product-style.ts`.

Crear `src/components/pedido/cart-summary.tsx`:
- Resumen del carrito, cantidades, total, botón "Pedir por WhatsApp".
- Diseño sticky en desktop; el checkout se abre en un `Dialog` (u otro componente drawer si se agrega más adelante).

### Tests

- `src/lib/catalog.test.ts`: regla de vendibilidad, agrupamiento por tipo.
- `src/application/services/catalogService.test.ts`: aislamiento por sucursal, filtrado de productos no vendibles, inactivos y eliminados, cálculo de disponibilidad, mapeo a DTO.
- `src/lib/whatsapp.test.ts`: generación correcta del mensaje y la URL, codificación, manejo de caracteres especiales.
- `tests/e2e/pedido.spec.ts`: flujo de visitar `/pedido`, agregar producto, abrir checkout, llenar datos y ver enlace de WhatsApp.
- `src/hooks/useCart.test.ts`: agregar, quitar, persistencia, limpieza por sucursal y validación de disponibilidad.

## Escalabilidad y recomendaciones

1. **Separar la cara pública del panel**: usar el route group `(public)` con su propio layout. Así el catálogo puede evolucionar independientemente del panel administrativo.
2. **Protección de rutas públicas**: si se agrega `middleware.ts` o se ajusta `auth.config.ts` en el futuro, permitir explícitamente `/pedido` y `/api/public/**` para evitar que `authorized` bloquee el catálogo. Hoy no hay `middleware.ts`, pero el layout `(public)` debe seguir libre de `auth()`.
3. **API pública versionada**: empezar con `/api/public/v1/catalogo` o dejar espacio para versionar futuro. Documentar que el contrato es estable.
4. **Carrito versionado**: guardar `localStorage` con key `pancheria-cart-v1` y schema Zod. Cuando se cambie el formato, se puede migrar sin perder pedidos pendientes.
5. **Persistencia futura de pedidos**: considerar agregar una tabla `customer_orders` con estado (`pending`, `confirmed`, `cancelled`) e ítems JSON. Esto permite, más adelante, autenticar clientes, mostrar historial y conectar con un panel de pedidos sin reescribir el flujo.
6. **Múltiples sucursales**: el selector de sucursal puede vivir en `/pedido?branchId=X`. Más adelante se puede detectar la más cercana o dejar que el cliente elija. La sucursal por defecto sigue siendo configurable por entorno.
7. **Pagos online**: el flujo actual es manual por WhatsApp. Para escalar, reservar un lugar en `src/config/catalog.ts` para un futuro `PAYMENT_PROVIDER` sin modificar la lógica del catálogo.
8. **WhatsApp Business API**: hoy se usa `wa.me`. A futuro se puede agregar un webhook que reciba confirmaciones y actualice `customer_orders`.
9. **Rate limiting en API pública**: la API pública es un punto de exposición. Usar una instancia de `RateLimitStore` (basada en IP) o una simple caché en memoria para evitar abuso.
10. **Cache de catálogo**: usar `unstable_cache` o `revalidate` en el Server Component para no golpear PostgreSQL en cada visita. El stock puede refrescarse en el cliente.
11. **Mobile-first**: la mayoría de clientes usará el celular. Priorizar tarjetas grandes, touch fácil, drawer de carrito y CTA flotante.

## Consideraciones de seguridad y entorno

- No hardcodear el número de WhatsApp, sucursal por defecto ni textos del mensaje.
- `.env.local` no debe commitearse. Actualizar `.env.example` y documentar las variables.
- La API pública acepta `branchId` como parámetro de consulta para filtrar, pero no lo incluye en la respuesta JSON.
- No devolver `ProductRow` completo en la API pública: mapear siempre a `PublicCatalogProduct`.
- Validar y sanitizar `branchId` en la API; no confiar en query params.
- No ejecutar `npx drizzle-kit push` ni `npx tsx src/db/seeds.ts` contra bases de datos con datos reales.
- Si se agrega persistencia de pedidos en el futuro, proteger datos personales según normativa local.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba |
