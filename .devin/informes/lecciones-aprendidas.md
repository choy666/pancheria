# Lecciones aprendidas — Guía rápida para prompts y auditorías futuras

> Resumen de lecciones extraídas de las auditorías del proyecto `pancheria`. Incluir este archivo en prompts futuros para evitar regresiones documentadas.

## Uso recomendado

- Incluir este archivo como referencia en prompts de **consolidación de calidad**, **configuración o conexión a base de datos**, **eliminación, soft delete o integridad de datos**, y cualquier otra tarea de auditoría.
- Para crear prompts nuevos, seguir la [guía de escritura de prompts](file:///C%3A/developer/paginas/pancheria/.devin/prompts/README.md).
- Índice del directorio de informes: [README.md](file:///C%3A/developer/paginas/pancheria/.devin/informes/README.md).
- Reglas y comandos del proyecto: <file:///C%3A/developer/paginas/pancheria/AGENTS.md>.

## 1. Configuración de entorno y base de datos

- **No usar `DATABASE_URL` apuntando a `localhost` salvo que haya un PostgreSQL local corriendo.** En desarrollo se recomienda apuntar a la misma base de Neon usada en producción para garantizar comportamiento idéntico.
- **Soportar la jerarquía de variables de Vercel Postgres.** El runtime debe probar `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`. Las migraciones deben probar `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` → `POSTGRES_URL`.
- **Nunca hardcodear credenciales, secretos ni URLs de API en el código.** Todos los valores sensibles deben venir de variables de entorno o configuraciones dinámicas.
- **Para migraciones en producción, usar `npx vercel env pull .env.production.local --environment=production`.** El archivo generado envuelve los valores en comillas dobles e incluye saltos de línea; al usar la URL hay que quitarlas con `.Trim().Trim('"')`. Borrar `.env.production.local` inmediatamente después. Ver el paso a paso en `.devin/informes/entornos.md`.
- **Verificar `NEXTAUTH_URL` y `AUTH_URL` en Vercel tras cada deploy.** Si `NEXTAUTH_URL` (o `AUTH_URL`, que en NextAuth v5 tiene prioridad) apunta a `http://localhost:3000`, las redirecciones de autenticación (ya sea por middleware o por Server Components) pueden enviar a `localhost` en lugar del dominio de producción.
- **No usar `STORAGE_PROVIDER=local` en producción si se almacenan videos.** El filesystem de Vercel es efímero; usar `vercel-blob`, `s3` o `r2` con sus credenciales. También se recomienda `vercel-blob` en desarrollo para no depender del filesystem local.
- **Ejecutar tests E2E solo en bases de datos de prueba.** `tests/e2e/global-setup.ts` trunca tablas de negocio y re-seedea. No usar en producción ni contra datos reales.
- **Los horarios de sucursal se almacenan como JSONB en `branches.opening_hours` y el cálculo de apertura usa `Intl.DateTimeFormat` con `NEXT_PUBLIC_BRANCH_TIMEZONE` para evitar suponer la zona horaria del servidor. La validación del envío de pedidos siempre ocurre en el servidor (`orderService.createOrder` consulta `getOpenCashRegister`); la UI solo mejora la UX mostrando el horario de apertura cuando la caja está cerrada.**
- **Configurar Playwright para que el `webServer` cargue `.env.e2e` y espere una ruta API, no la raíz.** Next.js 16 con Turbopack compila las rutas bajo demanda. Si Playwright inicia los tests tan pronto `http://localhost:3000` responde, las primeras requests a rutas API pueden recibir HTML/404 mientras se compilan. Usar `command: 'npm run dev:e2e'` (que cargue `.env.e2e`) y `url: 'http://localhost:3000/api/caja/resumen'` fuerza la compilación de una API antes de empezar. También se puede levantar manualmente con `npm run dev:e2e` y correr con `NO_WEB_SERVER=1`.
- **Los schedules de cron jobs no son variables de entorno.** `vercel.json` define los horarios de `rate-limit-cleanup` y `chat-attachments-cleanup`. No agregar `CHAT_ATTACHMENTS_CLEANUP_SCHEDULE` ni similares a `.env.example` o `AGENTS.md` si el código no las consume.
- **El rate limit de pedidos públicos está deshabilitado en desarrollo por defecto.** Para activarlo en `NODE_ENV=development`, definir `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV=true`.

## 2. Calidad de código y arquitectura

- **Verificar el patrón de manejo de errores antes de recomendar `throw new Error()`.** En Next.js con `useActionState`, una server action debe devolver el estado con `error`, no lanzar un error controlado.
- **Confirmar las limitaciones de librerías antes de documentarlas.** El código actual puede contradecir una suposición. Por ejemplo, Zod v4 sí soporta `productBaseSchema.partial().refine(...)`.
- **No mezclar helpers de UI con utilidades generales.** `src/lib/utils.ts` contiene `cn` de shadcn/ui. Las utilidades de JSON deben vivir en `src/lib/json.ts`.
- **Eliminar duplicaciones en helpers E2E.** Centralizar funciones como `unique`, `login` y `createProductViaApi` en `tests/e2e/helpers.ts`.
- **No ocultar reglas de negocio en helpers de test.** Los productos nuevos nacen con `stock: 0` y la carga inicial se registra con un movimiento `type: 'restock'`. Separar `createProductViaApi` de `restockProductViaApi` para mantener la regla visible.
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
- **Tener cuidado con `findFirst` cuando coexisten registros activos e inactivos.** Sin orden explícito puede devolver el registro inactivo y ocultar el activo, lo que lleva a decisiones incorrectas.
- **Agregar tests de cobertura para el caso "registro inactivo".** Permite detectar regresiones futuras en la lógica de eliminación.

## 5. Seguridad y entorno

- **Incluir siempre una sección de seguridad y entorno** cuando se trabaje con `.env.local`, credenciales o bases de datos. Recordar que `.env.local` no debe commitearse y que las credenciales deben rotarse si se expusieron.
- **Revisar imports obsoletos antes de incluirlos en un checklist.** Pueden haber sido resueltos en iteraciones anteriores; no ejecutar limpiezas sin verificar.

## 6. Documentación del proyecto

- **Mantener `AGENTS.md`, `README.md` y `.devin/environment.yaml` actualizados** cuando cambia la arquitectura, la conexión a base de datos o los comandos de verificación.

## 7. Pedidos públicos y panel de pedidos

- **El cambio de sucursal en `/pedido` debe invalidar el carrito.** `PedidoClient` se remonta con `key={branchId}`, `handleBranchChange` llama `clearCart()` antes de `router.push` y `useCart` descarta desde `localStorage` cualquier ítem cuya `branchId` no coincida.
- **Usar `data-testid` en componentes de catálogo y carrito para tests E2E.** `ProductCard` y `CartSummary` exponen `data-testid` basados en `product.id` (por ejemplo, `product-card-{id}`, `add-product-{id}` y `cart-item-{id}`) para que los tests de Playwright sean robustos.
- **No eliminar `productIds` del endpoint de disponibilidad del terminal de ventas.** El terminal `/ventas` precalcula la disponibilidad de todo el catálogo. El catálogo público `/pedido` solo requiere los items del carrito.
- **Extraer lógica común entre `createOrder`, `confirmSale` y `convertOrderToSale`.** Compartir `validateProductsForOperation`, `buildSaleItemValues` e `insertSaleAndUpdateCashRegister`. `convertOrderToSale` debe conservar los precios históricos de `order.items` para evitar desfasajes contables.
- **Un pedido público no debe reservar stock si el operador confirma manualmente por WhatsApp.** `createOrder` valida disponibilidad pero no descuenta stock; `convertOrderToSale` descuenta al confirmar; `cancelOrder` y la expiración no reintegran stock porque nunca fue descontado. Esto evita bloquear insumos en pedidos que el operador aún no confirmó.
- **La expiración de pedidos debe tolerar carreras con la confirmación.** `expirePendingOrders` debe capturar el error si un pedido ya no está `pending` (por ejemplo, fue confirmado mientras se limpiaban pedidos viejos) y continuar con el resto, devolviendo la cantidad realmente expirada.
- **`setState` dentro de `useEffect` está permitido en dos casos:** (a) carga asíncrona con flag de montaje (`isMountedRef` / `cancelled`) y cleanup; (b) persistencia derivada (`localStorage`). No usar para sincronizar props con estado; preferir cálculo en render, levantar estado al padre o `key` para forzar remonte.
- **`useCart` debe invalidar el carrito si `branchId` cambia en tiempo de ejecución**, no solo al montar, usando una referencia a la sucursal previa.
- **`PedidoClient` usa `activeBranch` como única fuente de verdad de la sucursal** y fuerza el remonte con `key={branchId}`; el selector expone `data-testid="branch-select-trigger"`.
- **El listado de pedidos (`/pedidos`) no hace polling automático por defecto.** `NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS` debe configurarse con un valor mayor a 0 para habilitarlo; de lo contrario, el operador actualiza manualmente con el botón "Actualizar".

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
