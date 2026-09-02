# Lecciones aprendidas — Guía rápida para prompts y auditorías futuras

> Resumen de lecciones extraídas de las auditorías del proyecto `pancheria`. Incluir este archivo en prompts futuros para evitar regresiones documentadas.

## Uso recomendado

- Incluir este archivo como referencia en prompts de **consolidación de calidad**, **configuración o conexión a base de datos**, **eliminación, soft delete o integridad de datos**, y cualquier otra tarea de auditoría.
- Para crear prompts nuevos, seguir la [guía de escritura de prompts](../prompts/README.md).
- Índice del directorio de informes: [README.md](README.md).
- Reglas y comandos del proyecto: <ref_file file="../../AGENTS.md" />.

## 1. Configuración de entorno y base de datos

- **No usar `DATABASE_URL` apuntando a `localhost` salvo que haya un PostgreSQL local corriendo.** En desarrollo se recomienda apuntar a la misma base de Neon usada en producción para garantizar comportamiento idéntico.
- **Soportar la jerarquía de variables de Vercel Postgres.** El runtime debe probar `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`. Las migraciones deben probar `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` → `POSTGRES_URL`.
- **Nunca hardcodear credenciales, secretos ni URLs de API en el código.** Todos los valores sensibles deben venir de variables de entorno o configuraciones dinámicas.
- **Para migraciones en producción, usar `npx vercel env pull .env.production.local --environment=production`.** El archivo generado envuelve los valores en comillas dobles e incluye saltos de línea; al usar la URL hay que quitarlas con `.Trim().Trim('"')`. Borrar `.env.production.local` inmediatamente después. Ver el paso a paso en `.devin/informes/entornos.md`.
- **Verificar `NEXTAUTH_URL` y `AUTH_URL` en Vercel tras cada deploy.** Si `NEXTAUTH_URL` (o `AUTH_URL`, que en NextAuth v5 tiene prioridad) apunta a `http://localhost:3000`, las redirecciones de autenticación (ya sea por middleware o por Server Components) pueden enviar a `localhost` en lugar del dominio de producción.
- **No usar `STORAGE_PROVIDER=local` en producción si se almacenan videos.** El filesystem de Vercel es efímero; usar `vercel-blob`, `s3` o `r2` con sus credenciales. También se recomienda `vercel-blob` en desarrollo para no depender del filesystem local.
- **Ejecutar tests E2E solo en bases de datos de prueba.** `tests/e2e/global-setup.ts` trunca tablas de negocio y re-seedea. El nombre de la base debe terminar en `test`, `e2e`, `testing`, `qa` o `staging`; `global-setup.ts` aborta si no es así, salvo que `E2E_ALLOW_REMOTE_DB=true` esté definido. No usar en producción ni contra datos reales.
- **Los horarios de sucursal se almacenan como JSONB en `branches.opening_hours` y el cálculo de apertura usa `Intl.DateTimeFormat` con `NEXT_PUBLIC_BRANCH_TIMEZONE` para evitar suponer la zona horaria del servidor. La validación del envío de pedidos siempre ocurre en el servidor (`orderService.createOrder` consulta `getOpenCashRegister`); la UI solo mejora la UX mostrando el horario de apertura cuando la caja está cerrada.**
- **Configurar Playwright para que el `webServer` cargue `.env.e2e` y espere una ruta API, no la raíz.** Next.js 16 con Turbopack compila las rutas bajo demanda. Si Playwright inicia los tests tan pronto `http://localhost:3000` responde, las primeras requests a rutas API pueden recibir HTML/404 mientras se compilan. Usar `command: 'npm run dev:e2e'` (que cargue `.env.e2e`) y `url: 'http://localhost:3000/api/caja/resumen'` fuerza la compilación de una API antes de empezar. También se puede levantar manualmente con `npm run dev:e2e` y correr con `NO_WEB_SERVER=1`.
- **Los schedules de cron jobs no son variables de entorno.** `vercel.json` define los horarios de `rate-limit-cleanup` y `chat-attachments-cleanup`. No agregar `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` ni similares a `.env.example` o `AGENTS.md` si el código no las consume.
- **El rate limit de pedidos públicos está deshabilitado en desarrollo por defecto.** Para activarlo en `NODE_ENV=development`, definir `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`.
- **El rate limit de pedidos públicos también está deshabilitado en `NODE_ENV=test` salvo que `E2E_ENABLE_RATE_LIMIT=true`.** Para que el E2E `tests/e2e/rate-limit-pedidos.spec.ts` bloquee en la tercera solicitud, se requieren `E2E_ENABLE_RATE_LIMIT=true`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2`, `TRUSTED_PROXY_IP_HEADER=X-Forwarded-For` (u otro header confiable) y `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`. La última es necesaria porque `npm run dev:e2e` ejecuta `next dev`, que fuerza `NODE_ENV=development`. Sin `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`, el rate limit se omite en el servidor de CI aunque `E2E_ENABLE_RATE_LIMIT=true` esté definido.
- **No confiar solo en `page.context().clearCookies()` para simular un logout en E2E con NextAuth v5.** El server component de `/login` redirige a `/` si aún detecta sesión. Usar un helper `clearSession(page)` que navegue a `/login`, limpie cookies, `localStorage` y `sessionStorage` antes de volver a llamar `loginAs` con otro usuario.

## 2. Calidad de código y arquitectura

- **Verificar el patrón de manejo de errores antes de recomendar `throw new Error()`.** En Next.js con `useActionState`, una server action debe devolver el estado con `error`, no lanzar un error controlado.
- **Confirmar las limitaciones de librerías antes de documentarlas.** El código actual puede contradecir una suposición. Por ejemplo, Zod v4 sí soporta `productBaseSchema.partial().refine(...)`.
- **No mezclar helpers de UI con utilidades generales.** `src/lib/utils.ts` contiene `cn` de shadcn/ui. Las utilidades de JSON deben vivir en `src/lib/json.ts`.
- **Eliminar duplicaciones en helpers E2E.** Centralizar funciones como `unique`, `login` y `createProductViaApi` en `tests/e2e/helpers.ts`.
- **No ocultar reglas de negocio en helpers de test.** Los productos nuevos nacen con `stock: 0` y la carga inicial se registra con un movimiento `type: 'restock'`. Separar `createProductViaApi` de `restockProductViaApi` para mantener la regla visible.
- **Aplicar la paginación en el repositorio en lugar de hacer `slice` en el handler.** `productRepository.findDeletedInRange` recibe `PaginationParams` y devuelve `PaginatedResult`, manteniendo el conteo `total` cerca de la base de datos y evitando cargar toda la colección en memoria.
- **No confiar en `getByText` con valores numéricos sueltos en tests E2E.** Un conteo como `2` puede coincidir con selectores de sucursal, precios u otros textos. Usar `data-testid` en el contenedor del resultado (`trash-result`, `trash-deleted-count`) para aserciones estables.
- **No leer `localStorage` ni otras APIs del cliente durante el render de un Client Component.** Eso incluye pasar el resultado como estado inicial de `useState`. En el primer render del servidor y del cliente el valor de `localStorage` no coincide, lo que provoca hydration mismatch. Inicializar el estado con un valor seguro para SSR (por ejemplo un arreglo vacío) y cargar el valor real en un `useEffect`. Ver el patrón aplicado en `useCart`.
- **No confundir `src/proxy.ts` con un archivo inactivo en Next.js 16+.** Next.js 16 renombró la convención `middleware.ts` a `proxy.ts` (puede vivir en `src/proxy.ts` o en `proxy.ts` en la raíz). El archivo exporta `proxy = auth` y `config.matcher`, y el build lo detecta como `ƒ Proxy (Middleware)`. Sin embargo, las redirecciones duplicadas en layouts/pages pueden ocultar la lógica real del proxy; mantener una sola fuente de verdad.
- **No confiar en `get` + `set` para operaciones que deben ser atómicas.** Las implementaciones en memoria (`InMemoryPublicOrderRateLimitStore`, `InMemoryRateLimitStore`) actualizan el contador sin `await` entre lectura y escritura, por lo que el event loop no interrumpe la operación. Para PostgreSQL se usa `INSERT ... ON CONFLICT` con expresiones de incremento en `DbPublicOrderRateLimitStore` y `DbRateLimitStore`. La idempotencia de ventas/pedidos se resuelve con `INSERT ... ON CONFLICT DO NOTHING` en las tablas correspondientes y una búsqueda posterior dentro de la transacción. En nuevos stores o contadores, seguir preferiendo `ON CONFLICT` o transacciones con `SELECT FOR UPDATE`.
- **No dejar endpoints públicos con operaciones de escritura sin rate limit.** `POST /api/public/pedido/[id]/chat/leido` ya aplica el mismo rate limit que el resto del chat público (`createRateLimiter('chat', ...)`). Al agregar nuevos endpoints de escritura públicos, reutilizar `createRateLimiter` con un scope propio.
- **Evitar workarounds permanentes sin fecha de deprecación.** El fallback de query param `?content=` en los `POST` de chat fue necesario por un bug de Next.js 16.3.0/Turbopack y se eliminó tras actualizar a 16.3.2. Los handlers actuales usan `request.json()` y solo caen en `catch` con un body vacío, no en query params. Documentar cualquier workaround nuevo con una fecha de revisión.
- **Validar que los fallbacks de URL base (`localhost:3000`) no se activen en producción.** `getPublicBaseUrl()` (centraliza el cálculo que antes hacían `storage.ts`, `chat-storage.ts` y `whatsapp.ts`) usa `http://localhost:3000` como fallback. Si `NEXT_PUBLIC_APP_URL` o `NEXTAUTH_URL` no están configurados en Vercel, los enlaces públicos y los mensajes de WhatsApp se generarán con `localhost`.

## 3. Manejo de errores y validaciones

- **Distinguir tipos de error en wrappers de API.** `NotFoundError` debe devolver `404`; no tratarlo como un `DomainError` genérico que devuelve `400`.
- **Unificar el manejo de errores de conexión a base de datos.** Todas las rutas de API deben devolver `503` ante `ECONNREFUSED` o errores de conexión, usando un helper centralizado si es posible.

## 4. Integridad de datos y soft delete

- **Las validaciones de integridad con soft delete deben considerar el estado del registro padre.** No basta con verificar la existencia de una relación; hay que descartar padres eliminados. Ejemplo: una receta cuya promo fue eliminada no debe bloquear el soft delete de un insumo.
- **Preferir soft delete sobre hard delete cuando existan tablas históricas.** `saleItems.productId` y `stockMovements.productId` referencian a `products.id`. Hard delete rompe la legibilidad del historial.
- **El soft delete no debe liberar archivos ni recetas asociadas.** La imagen de un producto y las recetas de una promo deben conservarse mientras el registro esté en papelera, para que la restauración sea completa. Liberar archivos (imágenes, videos) y dejar que la base de datos elimine en cascada las recetas debe ocurrir solo durante el hard delete.
- **Los stores en memoria del servidor no son caches de contenido, pero sí acumulan estado de negocio.** El singleton `RateLimitStore` puede conservar intentos fallidos de un usuario eliminado. Al eliminar usuarios o sucursales, invalidar esas entradas con `store.remove()` para evitar acumulación entre reinicios.
- **Invalidar entradas de rate limit de forma idempotente y fuera de la transacción principal.** La limpieza de `loginAttempts` no es crítica para el rollback; invocarla después del commit evita liberar entradas de una operación que finalmente falla.
- **Tener cuidado con `findFirst` cuando coexisten registros activos e inactivos.** Sin orden explícito puede devolver el registro inactivo y ocultar el activo, lo que lleva a decisiones incorrectas.
- **Agregar tests de cobertura para el caso "registro inactivo".** Permite detectar regresiones futuras en la lógica de eliminación.
- **Al eliminar una sucursal, liberar los archivos asociados fuera de la transacción.** `deleteBranch` recolecta las claves de imágenes, adjuntos y videos antes del commit, borra todas las filas en una transacción y luego elimina los archivos de los proveedores configurados. Si el borrado de archivos falla, la base de datos ya está limpia; los restos pueden detectarse con los crons de limpieza de adjuntos o un futuro cron de limpieza general.
- **Distinguir entre soft delete con historial y hard delete sin historial.** Productos, cajas y videos usan soft delete para conservar auditoría y permitir restauración; las imágenes/archivos permanecen mientras la entidad exista. La eliminación de una sucursal es hard delete y libera todo, incluidos los archivos, sin conservar historial.

## 5. Seguridad y entorno

- **Incluir siempre una sección de seguridad y entorno** cuando se trabaje con `.env.local`, credenciales o bases de datos. Recordar que `.env.local` no debe commitearse y que las credenciales deben rotarse si se expusieron.
- **Revisar imports obsoletos antes de incluirlos en un checklist.** Pueden haber sido resueltos en iteraciones anteriores; no ejecutar limpiezas sin verificar.

## 6. Documentación del proyecto

- **Mantener `AGENTS.md`, `README.md` y `.devin/environment.yaml` actualizados** cuando cambia la arquitectura, la conexión a base de datos o los comandos de verificación.
- **Incluir en `AGENTS.md`/`README.md` toda variable de entorno que esté en `.env.example`.** Si una feature agrega `process.env.*` nuevos (como las variables de imágenes de productos `NEXT_PUBLIC_PRODUCT_IMAGE_*`), deben documentarse en `AGENTS.md`, `README.md` y `.devin/environment.yaml` para evitar que operadores o futuros agentes ignoren la configuración.
- **Archivar los prompts resueltos y actualizar los índices.** Los prompts de funcionalidades ya implementadas (por ejemplo, pagos mixtos, promos con insumos opcionales, imágenes de productos) deben moverse a `.devin/prompts/archivados/` y reflejarse en `.devin/prompts/README.md` y `.devin/README.md` para no confundir al equipo.

## 7. Pedidos públicos y panel de pedidos

- **El cambio de sucursal en `/pedido` debe invalidar el carrito.** `PedidoClient` se remonta con `key={branchId}`, `handleBranchChange` llama `clearCart()` antes de `router.push` y `useCart` descarta desde `localStorage` cualquier ítem cuya `branchId` no coincida.
- **Usar `data-testid` en componentes de catálogo y carrito para tests E2E.** `ProductCard` y `CartSummary` exponen `data-testid` basados en `product.id` (por ejemplo, `product-card-{id}`, `add-product-{id}` y `cart-item-{id}`) para que los tests de Playwright sean robustos.
- **No eliminar `productIds` del endpoint de disponibilidad del terminal de ventas.** El terminal `/ventas` precalcula la disponibilidad de todo el catálogo. El catálogo público `/pedido` solo requiere los items del carrito.
- **Extraer lógica común entre `createOrder`, `confirmSale` y `convertOrderToSale`.** Compartir `validateProductsForOperation`, `buildSaleItemValues` e `insertSaleAndUpdateCashRegister`. `convertOrderToSale` debe conservar los precios históricos de `order.items` para evitar desfasajes contables.
- **Un pedido público no debe reservar stock si el operador confirma manualmente por WhatsApp.** `createOrder` valida disponibilidad pero no descuenta stock; `convertOrderToSale` descuenta al confirmar; `cancelOrder` y la expiración no reintegran stock porque nunca fue descontado. Esto evita bloquear insumos en pedidos que el operador aún no confirmó.
- **La expiración de pedidos debe tolerar carreras con la confirmación.** `expirePendingOrders` debe capturar el error si un pedido ya no está `pending` (por ejemplo, fue confirmado mientras se limpiaban pedidos viejos) y continuar con el resto, devolviendo la cantidad realmente expirada.
- **`setState` dentro de `useEffect` está permitido en dos casos:** (a) carga asíncrona con flag de montaje (`isMountedRef` / `cancelled`) y cleanup; (b) persistencia derivada (`localStorage`). No usar para sincronizar props con estado; preferir cálculo en render, levantar estado al padre o `key` para forzar remonte.
- **`useCart` debe invalidar el carrito si `branchId` cambia en tiempo de ejecución**, no solo al montar, usando una referencia a la sucursal previa.
- **`useCart` no debe pisar el carrito con `localStorage` si el usuario ya interactuó.** En tests E2E un click rápido puede ejecutarse antes del `useEffect` de carga inicial; se agrega un flag de interacción para saltar la carga inicial solo en ese primer montaje y seguir cargando al cambiar de sucursal.
- **`PedidoClient` usa `activeBranch` como única fuente de verdad de la sucursal** y fuerza el remonte con `key={branchId}`; el selector expone `data-testid="branch-select-trigger"`.
- **El listado de pedidos (`/pedidos`) no hace polling automático por defecto.** `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` debe configurarse con un valor mayor a 0 para habilitarlo; de lo contrario, el operador actualiza manualmente con el botón "Actualizar".
- **El intervalo de refresco del dashboard debería ser configurable.** `useDashboard.ts` usa `DASHBOARD_REFRESH_INTERVAL_MS = 30000` como constante interna. Si se requiere ajustarlo sin deploy, exponerlo como `NEXT_PUBLIC_DASHBOARD_REFRESH_INTERVAL_MS` con el mismo default.

## 8. Verificaciones estándar

Antes de dar por terminada una tarea, ejecutar los comandos pertinentes según el área:

| Comando | Cuándo usarlo |
| ------- | ------------- |
| `npm run lint` | Siempre |
| `npm run build` | Siempre |
| `npm test` | Cambios en servicios, repositorios o dominio |
| `npm run test:e2e` (o `npx playwright test`) | Cambios en flujos críticos de UI/E2E |
| `npx tsc --noEmit` | Cambios de tipos (también cubierto por `npm run build` / `npm run lint`) |
| `npx drizzle-kit push` | Cambios en esquema de base de datos |

> **Nota:** para tests E2E y migraciones de base de datos, usar solo entornos de prueba.

## 9. Tours interactivos y permisos de usuario

- **El tour interactivo debe adaptarse al rol del usuario.** Un recorrido único puede intentar navegar a rutas inaccesibles para un rol y generar redirecciones inesperadas. Construir los pasos dinámicamente según `admin` u `operator` evita esas interrupciones.
- **Usar `data-tour` en las secciones exclusivas de cada rol.** Las páginas administrativas (`/productos`, `/sucursales`, `/usuarios`) y el selector de sucursal deben tener sus propios atributos `data-tour` para que el tour las pueda resaltar.
- **Nunca hardcodear rutas de navegación del tour.** Las URLs deben obtenerse de `src/config/routes.ts` para mantener consistencia con el resto de la aplicación.
- **Usar `skipMissingElement: true` en pasos que resaltan elementos asíncronos.** El panel, las tablas y los selectores pueden no estar renderizados inmediatamente; `skipMissingElement` permite que el tour continúe sin romperse.
- **Integrar el componente cliente del dashboard en la página servidor.** Si `src/app/(panel)/page.tsx` no importa el componente cliente, el panel sigue mostrando accesos directos estáticos aunque el hook y el endpoint estén implementados. Verificar que la página pase `role`, `branchName` y `userName` al cliente y que el cliente haga el fetch autenticado.

## 10. Chat de pedidos

- **No ramificar componentes por `process.env.NODE_ENV === 'test'`.** Usar props como `disablePollingOnMount` para controlar comportamientos específicos de tests, y dejar que el componente decida en runtime.
- **Actualizar Next.js antes de aceptar workarounds permanentes.** El bug de `request.body === null` en `POST` de chat bajo `next dev` con Turbopack se resolvió al subir de Next.js 16.3.0 a 16.3.2. Después del upgrade, el cliente vuelve a enviar JSON body y el handler usa exclusivamente `request.json()`, sin conservar el fallback de query param `?content=`. Cualquier workaround temporal debe incluir una fecha de revisión y un test que falle cuando ya no sea necesario.
- **Deshabilitar compresión en `NODE_ENV=test` si aparecen warnings de Gzip.** En E2E con `npm run dev`, `compress: true` puede generar `MaxListenersExceededWarning: 11 drain listeners added to [Gzip]`. Usar `compress: process.env.NODE_ENV !== 'test'` en `next.config.ts`. El mensaje `Error: The destination stream closed early.` proviene del `createCancelHandler` de `react-server-dom-turbopack` y aparece cuando Playwright cierra la pestaña antes de que termine el streaming de React; `withApiErrorHandling` lo detecta como aborto de cliente y devuelve 499.
- **Agregar backoff al polling del chat.** Si un poll falla, duplicar el tiempo de espera hasta un máximo de 8 veces el intervalo configurado, y resetear el backoff ante `pageshow`, `visibilitychange` o un envío exitoso.
- **Usar cursores `before`/`after` para paginar mensajes.** El chat carga el historial con `before`, los nuevos mensajes del polling con `after`, y preserva el scroll al cargar mensajes anteriores. La página de chat público usa `dynamic = 'force-dynamic'`; no agregar directivas de cache redundantes.
- **Recordar el `customerName` de seguimiento y validar el banner de pedidos recientes.** Usar helpers aislados (`last-customer-name.ts`, `recent-orders.ts`) y `useSyncExternalStore` para evitar hydration mismatch y duplicar lógica en componentes.

## 11. Configuración de `knip` y validación de CI

- **No duplicar en `knip.json` entradas que Knip ya detecta automáticamente.** Si un workflow de GitHub Actions o un script de `package.json` referencia un archivo (por ejemplo, `npx tsx src/db/seeds.ts` en `.github/workflows/ci.yml`), Knip puede considerarlo un punto de entrada por sí solo. Incluirlo explícitamente en `entry` genera un `Configuration hint` redundante. Eliminar la entrada duplicada, ejecutar `npm run knip` y confirmar que no quedan hints.
- **Los avisos del IDE sobre `actions/checkout@v4` y `actions/setup-node@v4` son falsos positivos.** Esas son acciones oficiales de GitHub y el workflow es válido. El validador del IDE no las resuelve porque no puede consultar la API de GitHub o carece de acceso de red. No modificar `.github/workflows/ci.yml`; si se quiere silenciar el IDE, fijar las acciones a un SHA específico, aceptando el costo de mantenimiento.

## 12. Deprecación de WhatsApp y prioridad del chat propio

- **WhatsApp ya no es el canal prioritario de comunicación con el cliente.** El proyecto cuenta con un sistema de chat propio integrado en cada pedido. Nuevas funcionalidades deben mostrar la información en el chat, en el panel de pedidos y en el detalle del pedido, no depender de `src/lib/whatsapp.ts`.
- **No agregar nuevas dependencias ni tests basados en WhatsApp.** `buildWhatsAppMessage` y `buildWhatsAppUrl` se consideran en deprecación. Si una mejora requiere mostrar un resumen al cliente, usar el chat del pedido o el diálogo de confirmación (`pedido-success-dialog.tsx`).
- **El detalle de preparación de promos personalizadas debe estar en el chat y en el panel del operador.** El operador y el cliente deben ver el mismo detalle (insumos incluidos y quitados) sin salir de la aplicación.
- **La remoción completa de WhatsApp se hará en una tarea aparte.** Hasta entonces, se puede conservar el código existente, pero no se debe extender.

## 13. Promos con servicios, manuales y snapshots de receta

- **Una promo (`compound`) puede incluir insumos críticos, manuales y servicios.** Los críticos son obligatorios y tienen `autoDiscount: true`; los manuales y servicios son opcionales (`isOptional: true`) con `selectedByDefault` configurable. El precio de la promo es fijo y no cambia si se quitan complementos.
- **Los snapshots de receta persisten en `sale_item_recipes` y `order_item_recipes`.** Cada venta o pedido guarda la receta exacta seleccionada (`selected`, `isOptional`, `selectedByDefault`, cantidad, etc.), garantizando que futuras ediciones de la receta no modifiquen transacciones históricas.
- **El stock solo se descuenta/reintegra con los insumos `autoDiscount` seleccionados del snapshot.** Si un complemento opcional se quitó, no se descuenta ni se reintegra. La disponibilidad de una promo depende solo de los insumos críticos con `autoDiscount`.
- **`buildSaleItemValues` ahora retorna `productName` en cada ítem.** Esto permite construir mensajes y resúmenes sin volver a consultar el producto, pero obligó a actualizar `sale-helpers.test.ts` y `order-helpers.test.ts`.
- **`orderService.createOrder` inserta un mensaje automático en el chat con el detalle de preparación.** El mensaje se crea como remitente `'Sistema'` (`senderType: 'operator'`) e incluye los insumos incluidos y quitados para cada promo.
- **`PromoOptionsDialog` se usa en el catálogo público (`/pedido`) y en el terminal de ventas (`/ventas`).** Carga la receta desde el catálogo, inicializa los opcionales según `selectedByDefault`, bloquea los insumos críticos y devuelve los `selectedRecipeItemIds` al carrito.
- **Los resúmenes de caja y cierres incluyen `recipeSuppliesSummary`.** En la UI se muestra una nueva tarjeta "Insumos de recetas" en el panel de cierre (`closure-panel.tsx`) y en el CSV descargable.
- **El historial de ventas (`sales-history.tsx`) y el detalle de pedidos (`pedido-items-list.tsx`) muestran el detalle de preparación.** Se renderizan los insumos incluidos (`Incluye: ...`) y los opcionales quitados (`Sin: ...`).
- **`promo-form.tsx` permite configurar complementos opcionales.** La interfaz de administración carga todos los productos activos (no solo críticos), valida que haya al menos un insumo crítico con descuento automático y permite marcar manuales/servicios como opcionales y preseleccionados.

## 15. Formato de moneda y pagos en pesos argentinos

- **Los montos en la UI se muestran en pesos argentinos enteros, con separador de miles y sin centavos.** `src/lib/money.ts` expone `formatMoney(amount)` (`$ 1.500`) y `formatNumber(amount)` (`1.500`) usando `Intl.NumberFormat('es-AR')`, reemplazando el espacio duro (`U+00A0`) por espacio simple para consistencia en tests y DOM.
- **`PaymentPartsInput` trabaja con montos enteros.** Los inputs usan `type="number" inputMode="numeric" pattern="[0-9]*" step={1} min={0}`, y los valores ingresados se redondean con `Math.round`. El badge de resto usa `formatMoney`.
- **Los botones de denominación rápida suman al método activo sin superar el total.** La configuración vive en `src/config/payments.ts` y puede sobrescribirse con `NEXT_PUBLIC_PAYMENT_DENOMINATIONS`.
- **El botón "Completar resto" rellena el método activo con el monto faltante.** Si el pago ya cubre o supera el total, el botón se deshabilita.
- **La validación de pagos usa redondeo para mantener consistencia con la UI.** `sales-terminal.tsx` y `payment-helpers.ts` comparan `Math.round(paid) === Math.round(total)`. El almacenamiento interno sigue usando `numeric(10, 2)` para compatibilidad.
- **El monto inicial y el cierre de caja usan pesos enteros.** Los inputs de `caja-status.tsx` y `caja-panel.tsx` usan `type="number" inputMode="numeric" pattern="[0-9]*" step={1} min={0}` y `validateNonNegativeMoney` redondea con `Math.round`. El resumen de caja, el historial de cajas y el dashboard muestran `$ 1.500` sin centavos.

## 14. Módulo de ventas (`/ventas`)

- **Los productos agotados se ocultan por defecto en el catálogo del terminal.** Los servicios (`type === 'service'`) siempre se muestran porque no tienen límite de stock. Se agregó un toggle "Mostrar agotados" para casos excepcionales.
- **`POST /api/ventas/disponibilidad` sigue recibiendo el listado completo de IDs del catálogo cargado**, no solo los productos visibles en ese momento. Así, cuando el operador muestra los agotados, la disponibilidad ya está calculada y no queda desactualizada.
- **La lógica común del terminal se extrajo a helpers y subcomponentes.** `src/lib/ventas-helpers.ts` centraliza ordenamiento, selección de recetas y cálculo de disponibilidad adicional; `SalesProductCard` y `SalesCart` descomponen `SalesTerminal`.
- **El método de pago activo se distingue visualmente con `aria-pressed`, iconos y badge "Mixto".** El historial de ventas muestra los pagos como chips/badges separados en lugar de texto concatenado.
- **`updateQuantity` ahora usa la misma lógica de disponibilidad adicional que `addToCart`** (`getProductAdditional`), evitando el límite inconsistente cuando el cálculo de disponibilidad aún no regresó.
- **`SalesTerminal` conserva los pagos editados en `PaymentPartsInput` mientras el operador ajusta los montos.** La validación de que la suma coincida con el total queda en `confirmSale`, evitando que el componente resetee los inputs durante la edición de pagos mixtos.
