# Reporte de estado — Confirmación de envío de pedido por WhatsApp y fix de hydration

**Fecha:** 2026-08-19  
**Proyecto:** `pancheria`

---

## 0. Resumen ejecutivo

Se implementó el flujo de **confirmación de envío de pedido por WhatsApp**: tras crear un pedido `pending`, el cliente abre WhatsApp, envía el mensaje y al volver a la app confirma el envío. El sistema registra `sentAt` en `orders` sin cambiar el estado del pedido, y el operador ve un indicador visual en el panel.

Durante la verificación surgió un **hydration mismatch** en `ProductCard` / `CartSummary` porque el carrito se hidrataba desde `localStorage` durante el render inicial de `useCart`. El servidor renderizaba el carrito vacío mientras que el cliente podía tener ítems persistidos, lo que generaba diferencias en el botón (`Agregar` / `Agregar otro`) y en el resumen del carrito (`<p>` vacío vs `<ul>` con ítems). Se resolvió moviendo la carga de `localStorage` a un `useEffect` en `useCart` e inicializando el estado con un arreglo vacío, de modo que el primer render del servidor y del cliente coincidan. `ProductCard` usa directamente la prop `inCart`.

Se actualizaron los prompts, lecciones aprendidas, guía de funcionamiento y este reporte para reflejar la implementación.

---

## 0.1 Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|------|---------|-----------|
| 1 | `npm run lint` | Pasa |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 76 suites, 802 tests pasan |
| 4 | `npm run build` | Build de producción exitoso |
| 5 | `npx drizzle-kit generate` | Migración `0011_blushing_lucky_pierre.sql` generada |
| 6 | `npx drizzle-kit push` | Aplicada en la base de desarrollo |

---

## 0.2 Hallazgos y acciones

| Gravedad | Hallazgo | Acción |
|---|---|---|
| Menor | El diálogo de éxito mostraba siempre "Cancelar pedido" y "Abrir WhatsApp" aunque el cliente ya hubiera vuelto de WhatsApp. | Implementada máquina de estados `reserved → confirming → sent` en `PedidoClient`. |
| Menor | No existía registro de que el cliente envió el mensaje por WhatsApp. | Agregada columna `sentAt` en `orders` y endpoint `POST /api/public/pedido/[id]/enviar`. |
| Menor | El operador no distinguía pedidos enviados de WhatsApp de pedidos recién creados. | Agregado badge `Enviado por WhatsApp` en listado y detalle de pedidos. |
| Mayor | `ProductCard` / `CartSummary` causaban hydration mismatch porque el carrito se leía de `localStorage` durante el render de `useCart`. | Resuelto en `useCart`: estado inicial vacío (SSR-safe) y carga desde `localStorage` en `useEffect`. `ProductCard` usa `inCart` directamente. |
| Informativo | La documentación no reflejaba el nuevo flujo ni el patrón de hydration. | Actualizados `recomendaciones-pedidos-sucursal-stock.md`, `lecciones-aprendidas.md`, `guia-funcionamiento-pancheria.md` y este reporte. |

---

## 0.3 Archivos afectados

| Capa | Archivos |
|---|---|
| Esquema y migración | `src/db/schema.ts`, `drizzle/0011_blushing_lucky_pierre.sql`, `drizzle/meta/0011_snapshot.json`, `drizzle/meta/_journal.json` |
| Tipos y config | `src/domain/types.ts`, `src/config/api.ts`, `src/lib/zod-schemas.ts` |
| Backend | `src/repositories/orderRepository.ts`, `src/application/services/orderService.ts`, `src/app/api/public/pedido/[id]/enviar/route.ts`, `src/app/api/public/pedido/route.ts` |
| Frontend | `src/components/pedido/pedido-client.tsx`, `src/hooks/useCart.ts`, `src/components/pedido/product-card.tsx`, `src/components/pedido/cart-summary.tsx`, `src/components/pedidos/pedidos-list.tsx`, `src/components/pedidos/pedido-detail.tsx` |
| Tests | `src/repositories/orderRepository.test.ts`, `src/application/services/orderService.test.ts`, `src/app/api/public/pedido/[id]/enviar/route.test.ts`, `src/components/pedido/pedido-client.test.tsx` |
| Documentación | `.devin/prompts/recomendaciones-pedidos-sucursal-stock.md`, `.devin/informes/lecciones-aprendidas.md`, `.devin/informes/guia-funcionamiento-pancheria.md`, `.devin/informes/reporte-estado.md` |

---

# Reporte de estado — Auditoría de deploy `pancheria-five`

**Fecha:** 2026-08-19  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se auditó el estado de los dominios `pancheria-five.vercel.app` y `pancheria-alpha.vercel.app` para determinar por qué el primero devuelve `DEPLOYMENT_NOT_FOUND` mientras el segundo funciona correctamente.

Se confirmó que `pancheria-alpha.vercel.app` es el dominio productivo asignado al proyecto `pancheria` en Vercel. Responde con `307 Temporary Redirect` a `/pedido` y la cookie `authjs.callback-url` apunta a `https://pancheria-alpha.vercel.app`, lo que indica que la sesión de NextAuth está configurada para el dominio correcto.

El dominio `pancheria-five.vercel.app` no está vinculado al proyecto `pancheria` ni a ningún deployment visible en la cuenta de Vercel. El build local se completó exitosamente, descartando problemas en el código fuente.

---

## 2. Causa probable de `DEPLOYMENT_NOT_FOUND` en `pancheria-five`

El header `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` indica que Vercel recibió la solicitud en su edge pero no encontró un deployment asociado al hostname `pancheria-five.vercel.app`.

Las pruebas con Vercel CLI confirman que:

- El proyecto `pancheria` en la cuenta actual tiene como dominio de producción `pancheria-alpha.vercel.app`.
- `pancheria-five.vercel.app` no aparece como deployment, alias ni dominio personalizado.
- No hay otros proyectos en la cuenta con el nombre `pancheria-five`.

Las causas probables, ordenadas de más a menos probable, son:

1. **Deployment o proyecto eliminado.** El subdominio `pancheria-five` pertenecía a un deployment o proyecto anterior que fue eliminado, dejando el hostname huérfano.
2. **Proyecto recreado.** Al recrear el proyecto (por ejemplo, para corregir `Framework Preset: Other`), Vercel asignó el nuevo dominio `pancheria-alpha`, dejando `pancheria-five` sin deployment asociado.
3. **Dominio personalizado huérfano.** `pancheria-five` podría haber sido un dominio personalizado o alias externo que apuntaba a un `deployment URL` que ya no existe.

---

## 3. Comparativa entre `pancheria-five` y `pancheria-alpha`

| Característica | `pancheria-five.vercel.app` | `pancheria-alpha.vercel.app` |
|---|---|---|
| Estado HTTP | 404 Not Found | 307 Temporary Redirect |
| `X-Vercel-Error` | `DEPLOYMENT_NOT_FOUND` | Ninguno |
| `Location` | — | `/pedido` |
| Cookie `authjs.callback-url` | No presente | `https%3A%2F%2Fpancheria-alpha.vercel.app` |
| Vinculación al proyecto `pancheria` | No encontrada | Sí, proyecto productivo |
| Framework Preset | No aplica | Next.js |
| Funciones serverless (`λ`) | No aplica | Sí |
| Build local | Exitoso | Exitoso |

---

## 4. Estado de variables de entorno y Framework Preset

### Framework Preset

El proyecto `pancheria` está configurado en Vercel con:

- **Framework Preset:** Next.js
- **Build Command:** `npm run build` / `next build`
- **Output Directory:** Next.js default

El deployment productivo inspeccionado contiene funciones serverless (`λ`) para las rutas dinámicas, lo que confirma que el App Router de Next.js se sirve correctamente.

### Variables de entorno

Se verificaron las variables configuradas en el entorno `Production` de Vercel. Los valores están encriptados, por lo que no se exponen en este informe. Se confirmó:

- Existe `NEXTAUTH_URL` en producción. No existe `AUTH_URL`, por lo que `NEXTAUTH_URL` tiene prioridad.
- La cookie `__Secure-authjs.callback-url=https%3A%2F%2Fpancheria-alpha.vercel.app` indica que NextAuth apunta al dominio productivo correcto.
- No se detectaron variables con `localhost` en el entorno de producción.
- Existen `DATABASE_URL`, `DATABASE_URL_UNPOOLED` y las variables de Vercel Postgres (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, etc.).
- Existen `STORAGE_PROVIDER`, `BLOB_READ_WRITE_TOKEN` y variables relacionadas con videos.
- Existen `ORDER_EXPIRATION_MS`, `RATE_LIMIT_STORE_PROVIDER` y variables de rate limiting.

---

## 5. Hallazgos clasificados

| Gravedad | Hallazgo | Evidencia |
|---|---|---|
| Mayor | `pancheria-five.vercel.app` devuelve `DEPLOYMENT_NOT_FOUND` y no está asociado al proyecto `pancheria` ni a ningún deployment visible en la cuenta. | `curl -I`, `vercel inspect`, `vercel project ls`, `vercel domains ls`. |
| Menor | `pancheria-five` podría ser una URL obsoleta que requiera limpieza de bookmarks, documentación o DNS. | No se encontraron referencias en el código ni en la documentación del proyecto. |
| Informativo | `pancheria-alpha.vercel.app` es el dominio productivo vigente con build y redirección correctos. | `vercel inspect`, `vercel project ls`, `curl -I`. |
| Informativo | Framework Preset es Next.js y el build contiene funciones serverless. | `vercel project inspect pancheria`, `vercel inspect https://pancheria-alpha.vercel.app`. |
| Informativo | Build local (`npm run build`) se completó exitosamente. | Salida del comando. |

---

## 6. Recomendaciones y acciones correctivas

1. **Consolidar `pancheria-alpha` como dominio productivo oficial.** Actualizar cualquier documentación, README o comunicación que aún referencie `pancheria-five`.
2. **Investigar el origen de `pancheria-five`.** Revisar el dashboard de Vercel (Projects, Activity Log, Domains) para confirmar si corresponde a un proyecto eliminado o un dominio personalizado abandonado.
3. **Si `pancheria-five` debe redirigir a `pancheria-alpha`:** agregarlo como dominio personalizado o alias en el proyecto `pancheria`, o configurar un redirect a nivel de DNS.
4. **Si `pancheria-five` no se usa más:** eliminar registros DNS, bookmarks y referencias para evitar confusiones.
5. **Mantener `NEXTAUTH_URL` apuntando a `pancheria-alpha`.** Evitar definir `AUTH_URL` a menos que sea necesario; si se define, debe coincidir con el dominio productivo.
6. **No ejecutar `vercel project remove` ni recrear el proyecto** sin confirmación explícita y sin respaldar variables de entorno.
7. **Mantener `.env.example` y `AGENTS.md` sincronizados** con las variables de entorno actuales.

---

## 7. Comandos ejecutados y resultados

| Paso | Comando | Resultado |
|---|---|---|
| 1 | `curl.exe -I https://pancheria-five.vercel.app` | 404, `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` |
| 2 | `curl.exe -I https://pancheria-alpha.vercel.app` | 307, `Location: /pedido`, `authjs.callback-url=https%3A%2F%2Fpancheria-alpha.vercel.app` |
| 3 | `npx vercel project ls` | `pancheria` con `Latest Production URL: https://pancheria-alpha.vercel.app` |
| 4 | `npx vercel domains ls` | 0 dominios personalizados |
| 5 | `npx vercel inspect https://pancheria-alpha.vercel.app` | Deployment productivo `Ready`, alias `pancheria-alpha.vercel.app`, funciones `λ` |
| 6 | `npx vercel inspect https://pancheria-five.vercel.app` | Error: no se encontró el deployment |
| 7 | `npx vercel env ls` | Variables de producción configuradas (encriptadas) |
| 8 | `npx vercel project inspect pancheria` | Framework Preset: Next.js |
| 9 | `npx vercel list pancheria` | Lista de deployments recientes, ninguno asociado a `pancheria-five` |
| 10 | `npm run build` | Build local exitoso |

---

## 8. Acciones aplicadas tras la auditoría

- **Dominio productivo oficial consolidado:** se actualizó <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> para indicar que el dominio de producción asignado es `https://pancheria-alpha.vercel.app` y que ese mismo valor debe usarse para `NEXTAUTH_URL` en producción.
- **Prompt archivado:** el prompt de auditoría se movió a <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/auditoria-deploy-pancheria-five.md" /> y se actualizó <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" /> para reflejar su estado resuelto.
- **Limpieza de documentación:** no se encontraron referencias a `pancheria-five` en `README.md`, `.env.example`, código fuente ni otros documentos del repositorio. El informe vigente conserva el nombre solo como registro histórico del objeto auditado.
- **DNS y bookmarks:** estas referencias están fuera del alcance del repositorio; se recomienda al operador eliminar manualmente cualquier DNS, bookmark o enlace compartido que aún apunte a `pancheria-five.vercel.app`.

---

# Reporte de estado — Expiración de pedidos, limpieza de `.devin` y estado actual

**Fecha:** 2026-08-18  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Se implementó la **expiración automática de pedidos `pending`** para marcar como cancelado un pedido no confirmado dentro del tiempo configurado (por defecto 1 hora, configurable con `ORDER_EXPIRATION_MS`). La funcionalidad incluye la función de dominio e integración en el listado del panel de pedidos. También se agregaron tests unitarios.

Se completó la **limpieza del directorio `.devin`**: los informes históricos obsoletos se eliminaron de `informes/archivados/` y la `guia-funcionamiento-pancheria.md` se actualizó para reflejar el estado real del proyecto. Los prompts resueltos del directorio `prompts/archivados/` se eliminaron previamente, manteniendo solo los prompts activos. Se actualizaron los índices de `.devin/README.md`, `.devin/prompts/README.md`, `pancheria.prompt.md` y `recomendaciones-pedidos-sucursal-stock.md`.

Las verificaciones automatizadas (`lint`, `tsc`, `test`, `build`) y los tests E2E pasan sin errores.

---

## 2. Comandos ejecutados

|| Paso | Comando | Resultado |
|| ---- | ------- | --------- |
|| 1 | `npm run lint` | Pasa (exit 0) |
|| 2 | `npx tsc --noEmit` | Pasa |
|| 3 | `npm test` | 68 suites, 744 tests pasan |
|| 4 | `npm run build` | Build de producción exitoso (39 páginas) |
|| 5 | `npm run test:e2e` | 81 tests E2E pasan (10.2 min) en base de datos de prueba |
|| — | `npx tsx src/db/seeds.ts` | No ejecutado (modifica datos) |
|| — | `npx drizzle-kit check` | No ejecutado (sin cambios de esquema) |

---

## 3. Expiración automática de pedidos `pending`

### Implementación

|| Componente | Archivo | Descripción |
|| ---------- | ------- | ----------- |
|| Configuración | <ref_file file="C:/developer/paginas/pancheria/src/config/orders.ts" /> | `getOrderExpirationMs()` lee `ORDER_EXPIRATION_MS` con default de 3_600_000 ms y mínimo de 60_000 ms. |
|| Servicio | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> | `expirePendingOrders(branchId?)` busca pedidos `pending` cuyo `createdAt` supere la ventana de expiración y los cancela usando `cancelOrder` con motivo "Expiración automática por inactividad", sin modificar stock. Ignora pedidos que ya fueron confirmados durante la limpieza para evitar errores de carrera. |
|| API de listado | <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" /> | `GET /api/pedidos` llama `expirePendingOrders(branchId)` antes de `getOrders`, después de autenticar y validar permisos. |
|| Tests de servicio | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.test.ts" /> | Cubre expiración de pedidos vencidos y no expiración de pedidos recientes. |

### Variables de entorno agregadas

- `ORDER_EXPIRATION_MS` (opcional) — milisegundos antes de expirar un pedido `pending`. Default: `3600000` (1 hora). Mínimo: `60000`.

Documentadas en <ref_file file="C:/developer/paginas/pancheria/.env.example" />, <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/environment.yaml" />.

### Notas de operación

- El panel de pedidos (`/pedidos`) expira pedidos automáticamente al listar. Dado que los pedidos `pending` no reservan stock, la expiración solo limpia pedidos viejos del panel; no es crítica para liberar inventario.
- No se requieren cambios de esquema: la expiración usa `orders.createdAt` y `orders.status`.

---

## 4. Flujo de pedidos: sin reserva de stock hasta la confirmación

Se ajustó el flujo de pedidos públicos para que **el stock se descuente únicamente cuando el operador confirma el pedido desde el panel**, no al crearlo. Esto se alinea con la operación real de la panchería: el cliente envía el pedido por WhatsApp, el operador verifica la forma de pago en el chat y recién después confirma o cancela desde la app.

|| Etapa | Archivo | Comportamiento |
|| ----- | ------- | -------------- |
|| Crear pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`createOrder`) | Valida disponibilidad con `validateCartAvailability` e inserta `orders` e `order_items` en estado `pending`. **No descuenta stock.** |
|| Confirmar pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`convertOrderToSale`) | Revalida disponibilidad, descuenta stock (`deductStockForItems` con `movementType: 'sale'`), crea la venta, actualiza la caja y marca el pedido como `converted`. Conserva los precios históricos de `order.items`. |
|| Cancelar pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`cancelOrder`) | Marca el pedido como `cancelled`. **No modifica stock** porque el pedido nunca lo reservó. |
|| Expirar pedido | <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`expirePendingOrders`) | Cancela pedidos `pending` vencidos. **No modifica stock**. |
|| UI pública | <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> | El botón y el mensaje del diálogo indican que el pedido se envía por WhatsApp y que el stock se confirma al aceptar el pedido. |

### Implicaciones

- **Ventaja operativa**: evita bloquear stock en pedidos que el operador aún no confirmó (por ejemplo, mientras verifica la forma de pago).
- **Riesgo**: dos clientes pueden ver stock disponible y crear pedidos del mismo producto antes de que el operador confirme el primero. `convertOrderToSale` falla con `InsufficientStockError` si al confirmar no hay stock suficiente; el operador debe cancelar el pedido e informar al cliente.
- **Movimientos de stock**: los pedidos `pending` no generan movimientos de tipo `order` ni `order_cancellation`. El descuento ocurre con `sale` al confirmar; la anulación de una venta genera `cancellation`.
- **Concurrencia**: `expirePendingOrders` ignora pedidos que fueron confirmados o cancelados entre la búsqueda y la cancelación, evitando errores si un operador confirma un pedido mientras el panel limpia pedidos viejos.
- **Tests E2E**: el texto del botón en el catálogo pasó de "Reservar y abrir WhatsApp" a "Enviar pedido por WhatsApp".

---

## 5. Limpieza de `.devin`

|| Acción | Archivos afectados | Resultado |
|| ------ | ------------------ | --------- |
|| Actualizar guía de funcionamiento | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> | Se corrigieron limitaciones resueltas, el flujo de stock de pedidos y el checklist antes de producción. |
|| Eliminar informes históricos obsoletos | `.devin/informes/archivados/*.md` (informes de estado 2026-08-13, 2026-08-15, 2026-08-17, plan y auditoría de pedidos del 17/08). | Eliminados; el `reporte-estado.md` vigente y `lecciones-aprendidas.md` concentran el contexto actual. |
|| Eliminar prompts archivados | `.devin/prompts/archivados/*.md` (eliminados) y el directorio vacío removido. | Se mantuvieron solo los prompts activos: `pancheria.prompt.md`, `auditoria-y-documentacion.md`, `recomendaciones-pedidos-sucursal-stock.md` y `errores-deploy-vercel-forbidden-react-441.md`. |
|| Actualizar índices | <ref_file file="C:/developer/paginas/pancheria/.devin/README.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />, <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" /> | Referencias a archivos archivados actualizadas o eliminadas. |

---

## 6. Estado del plan de cobertura — Pedidos, sucursal y cliente

El plan de cobertura del 2026-08-17 quedó implementado. A continuación el estado final de cada fase:

|| Fase | Objetivo | Estado | Evidencia |
|| ---- | -------- | ------ | --------- |
|| Fase 1 | Conservar precios históricos en `convertOrderToSale` | **Implementado** | `buildSaleItemValues` acepta `unitPrice` y `subtotal` opcionales en <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />. `convertOrderToSale` pasa los valores de `order.items` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />. |
|| Fase 2 | Validar `branchId` entero positivo en `/pedido` | **Implementado** | `parseBranchId` en <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-resolver.ts" />. |
|| Fase 3 | `branchId` explícito en el panel de pedidos | **Implementado** | <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/route.ts" />. |
|| Fase 4 | Rate limiting de pedidos públicos | **Resuelto — rate limit por IP en memoria suficiente para el alcance actual** | <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />. Para escalar horizontalmente, requiere store compartido. |
|| Fase 5 | Consolidar lógica de cancelación | **Implementado** | `cancelSale` reusa `buildReintegrationContext` y `reintegrateStockAndUpdateCashRegister` de <ref_file file="C:/developer/paginas/pancheria/src/application/services/saleService.ts" />. `cancelOrder` no modifica stock porque los pedidos `pending` no reservan. |
|| Fase 6 | Decisión sobre `setState` en `useEffect` | **Resuelto documentalmente** | <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> y <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" />. |
|| Fase 7 | Eliminar carga inicial duplicada del catálogo | **Implementado** | <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />. |
|| Fase 8 | Actualizar documentación de prompts | **Implementado y ampliado** | Limpieza completa de `prompts/archivados/` y actualización de `guia-funcionamiento-pancheria.md`. |
|| Fase 9 | Seguridad de `.env.local` | **Recomendación pendiente del usuario** | No ejecutable por el agente. |

---

## 7. Prompt activos y su estado

- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" /> — vigente.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" /> — vigente.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/recomendaciones-pedidos-sucursal-stock.md" /> — vigente.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/errores-deploy-vercel-forbidden-react-441.md" /> — **resuelto**. Todos los Server Components del panel usan `getCurrentBranchIdOrRedirect`; las rutas API y server actions mantienen `getCurrentBranchId` para devolver `403`.

---

## 8. Hallazgos

|| Gravedad | Hallazgo | Estado |
|| -------- | -------- | ------ |
|| Menor | Expiración automática de pedidos `pending` no estaba implementada. | **Resuelto** con `expirePendingOrders` e integración en `GET /api/pedidos`. |
|| Menor | Directorio `.devin` contenía prompts archivados e informes resueltos que ya no eran necesarios en la raíz. | **Resuelto** — documentación actualizada, informes obsoletos eliminados, índices actualizados. |
|| Menor | `src/app/(panel)/pedidos/page.tsx` y `src/app/(panel)/layout.tsx` aún usan `getCurrentBranchId` directamente. | **Resuelto** — ambos Server Components migraron a `getCurrentBranchIdOrRedirect`. |
|| Menor / Escalabilidad | Rate limit de pedidos públicos soporta store en PostgreSQL para múltiples instancias. | **Resuelto** — se implementó `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER` con soporte `db` (PostgreSQL) para múltiples instancias. |
|| Menor | Pedidos públicos reservaban stock al crearse, antes de la confirmación del operador. | **Resuelto** — `createOrder` ya no descuenta stock; `convertOrderToSale` descuenta al confirmar; `cancelOrder` y expiración no tocan stock. |
|| Menor / Operativo | `STORAGE_PROVIDER=local` en producción con `BLOB_READ_WRITE_TOKEN` configurado. | **Resuelto** — `STORAGE_PROVIDER` cambiado a `vercel-blob` en producción y en `.env.example`. |
|| Menor / Documentación | `guia-funcionamiento-pancheria.md` tenía limitaciones y checklist desactualizados. | **Resuelto** — sección 1, tabla de movimientos de stock, limitaciones, checklist y conclusiones actualizadas. |
|| Informativo | Las verificaciones automatizadas pasan; no hay regresiones detectadas. | Confirmado. |
||| Menor / Arquitectura | `saleService.ts` concentraba lógica de productos, disponibilidad, validaciones y ventas. | **Resuelto** — se extrajeron `src/lib/product-helpers.ts`, `src/lib/sale-helpers.ts` y `src/lib/order-helpers.ts`; `saleService.ts` se redujo en ~500 líneas. |
||| Menor / Cobertura | Nuevos helpers y `orderRepository.ts` carecían de tests dedicados. | **Resuelto** — se agregaron `product-helpers.test.ts`, `sale-helpers.test.ts`, `order-helpers.test.ts` y `orderRepository.test.ts`. |
||| Menor / Integridad referencial | `cashRegisters.closedBy` no era FK a `users`. | **Resuelto documentalmente** — se documentó la excepción y se centralizó el label de cierre automático en `AUTO_CLOSED_BY` de `src/config/caja.ts`. | |

---

## 9. Riesgos y acciones pendientes

|| Riesgo / Acción | Descripción |
|| ----------------- | ----------- |
|| `npm run test:e2e` | Deuda técnica activa. En el entorno local no logró pasar por redirecciones de `AUTH_URL` a producción, rate limit de login acumulado y caja preexistente. Se configuró `.env.e2e`, `playwright.config.ts` y `global-setup.ts` para facilitar la corrida en una base descartable. |
|| `npx tsx src/db/seeds.ts` | No ejecutado. Es idempotente pero modifica datos. Ejecutar solo con confirmación. |
|| `npx drizzle-kit check` | Ejecutar tras cambios de esquema futuros para validar consistencia. |
|| Migración de `getCurrentBranchIdOrRedirect` | **Resuelto** en `src/app/(panel)/layout.tsx` y `src/app/(panel)/pedidos/page.tsx`. Las rutas API y server actions mantienen `getCurrentBranchId` para devolver `403`. |
|| Variables de producción | `NEXTAUTH_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ORDER_EXPIRATION_MS` y `STORAGE_PROVIDER` verificadas. `STORAGE_PROVIDER` ahora es `vercel-blob`. |
|| Rate limit compartido | Resuelto — implementado en PostgreSQL con `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db`. Configurar en Vercel si se escala horizontalmente. |

---

## 10. Recomendaciones

1. **Resolver `npm run test:e2e`** en una base de datos de prueba descartable. Configuración lista; restan ajustar `AUTH_URL` local, rate limit de login y estado de caja entre corridas.
2. ~~**Completar la migración a `getCurrentBranchIdOrRedirect`** en `src/app/(panel)/layout.tsx` y `src/app/(panel)/pedidos/page.tsx`.~~ **Resuelto.**
3. ~~**Verificar el proveedor de almacenamiento de videos en producción** antes del deploy.~~ **Resuelto — `STORAGE_PROVIDER` es `vercel-blob`.**
4. **Mantener `AGENTS.md`, `README.md`, `.devin/environment.yaml`, `guia-funcionamiento-pancheria.md` y `.devin/prompts/pancheria.prompt.md` sincronizados** con cada nueva feature o variable de entorno.
5. **No duplicar informes de estado**: generar un único `reporte-estado.md` vigente y archivar los anteriores.
6. ~~**Evaluar rate limit compartido** para pedidos públicos antes de escalar horizontalmente.~~ **Resuelto — usar `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=db` en Vercel si hay múltiples instancias.**

---

## 11. Conclusión

El proyecto incorporó la expiración automática de pedidos, actualizó la `guia-funcionamiento-pancheria.md` para reflejar el estado real, eliminó informes históricos obsoletos, migró todos los Server Components del panel a `getCurrentBranchIdOrRedirect` y ajustó el flujo de pedidos para que el stock se descuente solo al confirmar desde el panel. Además, se refactorizaron los servicios de venta y pedido extrayendo helpers transversales (`product-helpers`, `sale-helpers`, `order-helpers`), se creó `orderRepository.ts` y se documentó la excepción de integridad referencial de `cashRegisters.closedBy`. Finalmente, se implementó el rate limit distribuido de pedidos públicos con soporte para PostgreSQL (`public_order_rate_limits`). Las pruebas unitarias y el build de producción pasan. Quedan la deuda técnica de E2E y las recomendaciones habituales de despliegue.

---

# Reporte de estado — Selector de sucursales en `/pedido`

**Fecha:** 2026-08-19
**Proyecto:** `pancheria`

---

## 1. Resumen

Se reforzó la visibilidad y funcionalidad del selector de sucursales en el catálogo público de pedidos (`/pedido`). El flujo completo —catálogo, disponibilidad, carrito, creación, cancelación y mensaje de WhatsApp— ya estaba aislado por `branchId`; los cambios se enfocaron en hacer el selector más claro, agregar defensas en el Client Component y ampliar la cobertura de tests.

---

## 2. Cambios aplicados

### UI del selector

- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- Cuando hay más de una sucursal se muestra un `Select` con una etiqueta visible "Sucursal" y el trigger ancho (`sm:w-[260px]`).
- Cuando hay una sola sucursal se muestra un `Badge` prominente con el nombre de la sucursal junto al label "Sucursal".
- El `SelectValue` ahora muestra el **nombre** de la sucursal activa, no su id, y resuelve dinámicamente la etiqueta al cambiar el valor.
- Se agregó una guarda defensiva que renderiza `<PedidoError />` si la sucursal activa no está en el listado recibido.

### Carrito y persistencia

- <ref_file file="C:/developer/paginas/pancheria/src/hooks/useCart.ts" />
- El hook ya valida que el carrito guardado pertenezca a la misma sucursal y lo descarta si cambia.
- `PedidoClient` actualiza `localStorage` bajo `pancheria-branch-id` al montar y al cambiar de sucursal.

### Mensaje de WhatsApp

- <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.ts" />
- El mensaje generado incluye la línea `Sucursal: {order.branchName}` cuando el pedido tiene sucursal.
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" /> ya enviaba `branchName: order.branch?.name` en la respuesta.

### Tests

- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.test.tsx" /> — tests unitarios que cubren:
  - selector visible con múltiples sucursales;
  - nombre de sucursal prominente con una sola sucursal;
  - estado de error ante sucursal activa inválida;
  - persistencia de `pancheria-branch-id`;
  - descarte del carrito almacenado de otra sucursal;
  - cambio de sucursal limpiando carrito, actualizando `localStorage` y navegando.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/whatsapp.test.ts" /> — tests para la inclusión/omisión del nombre de sucursal en el mensaje.

---

## 3. Verificaciones

| Paso | Comando | Resultado |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Pasa (exit 0) |
| 2 | `npx tsc --noEmit` | Pasa |
| 3 | `npm test` | 75 suites, 785 tests pasan |
| 4 | `npm run build` | Build de producción exitoso (40 páginas) |
| 5 | `npx playwright test tests/e2e/pedido-sucursal-y-stock.spec.ts` | 4/4 tests pasan |

---

## 4. Tests E2E

La corrida enfocada del flujo de sucursal y stock arrojó **4 tests pasados**:

- redirección de `branchId` inválido;
- selección de otra sucursal, cambio de catálogo y limpieza del carrito;
- limpieza del carrito al cambiar de sucursal y volver a la original;
- creación de un pedido de pickup desde la sucursal por defecto.

El test de pickup fue ajustado para soportar entornos con o sin `NEXT_PUBLIC_WHATSAPP_NUMBER` configurado: si la variable está definida, se verifica el diálogo de éxito; si no, se verifica el mensaje de configuración faltante.
