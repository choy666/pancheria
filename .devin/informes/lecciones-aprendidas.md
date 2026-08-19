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
- **Verificar `NEXTAUTH_URL` y `AUTH_URL` en Vercel tras cada deploy.** Si `NEXTAUTH_URL` (o `AUTH_URL`, que en NextAuth v5 tiene prioridad) apunta a `http://localhost:3000`, el middleware redirige a `localhost` en lugar del dominio de producción.
- **No usar `STORAGE_PROVIDER=local` en producción si se almacenan videos.** El filesystem de Vercel es efímero; usar `vercel-blob`, `s3` o `r2` con sus credenciales. También se recomienda `vercel-blob` en desarrollo para no depender del filesystem local.
- **Ejecutar tests E2E solo en bases de datos de prueba.** `tests/e2e/global-setup.ts` trunca tablas de negocio y re-seedea. No usar en producción ni contra datos reales.

## 2. Calidad de código y arquitectura

- **Verificar el patrón de manejo de errores antes de recomendar `throw new Error()`.** En Next.js con `useActionState`, una server action debe devolver el estado con `error`, no lanzar un error controlado.
- **Confirmar las limitaciones de librerías antes de documentarlas.** El código actual puede contradecir una suposición. Por ejemplo, Zod v4 sí soporta `productBaseSchema.partial().refine(...)`.
- **No mezclar helpers de UI con utilidades generales.** `src/lib/utils.ts` contiene `cn` de shadcn/ui. Las utilidades de JSON deben vivir en `src/lib/json.ts`.
- **Eliminar duplicaciones en helpers E2E.** Centralizar funciones como `unique`, `login` y `createProductViaApi` en `tests/e2e/helpers.ts`.
- **No ocultar reglas de negocio en helpers de test.** Los productos nuevos nacen con `stock: 0` y la carga inicial se registra con un movimiento `type: 'restock'`. Separar `createProductViaApi` de `restockProductViaApi` para mantener la regla visible.
- **Evitar `setState` directo en `useEffect` para corregir hydration mismatch.** El linter del proyecto prohíbe este patrón salvo carga asíncrona con flag de montaje o persistencia derivada. Si una prop depende de estado que solo existe en el cliente (por ejemplo `localStorage`), preferir `useSyncExternalStore` con `getServerSnapshot` para que el servidor y el cliente rendericen el mismo contenido en el primer paso.

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
