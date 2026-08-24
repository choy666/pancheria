# ARCHIVADO — Prompt: Auditoría del chat de pedidos — workaround de body, warnings y mejoras pendientes

> **Estado: resuelto.** El workaround de query param fue eliminado al actualizar a Next.js 16.3.2, la compresión se maneja con `compress: process.env.NODE_ENV !== 'test'`, se reemplazó la guarda `process.env.NODE_ENV === 'test'` por la prop `disablePollingOnMount` y la página de chat usa `dynamic = 'force-dynamic'`. Ver `.devin/informes/reporte-estado.md` y `.devin/informes/lecciones-aprendidas.md`.

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y cierre de caja.

Stack: Next.js 16.3.2, React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/plan-mejoras-chat-pedido.md" />

## Estado actual relevante

El flujo de chat de pedidos ya está funcional y pasa las verificaciones estándar (`npm test`, `npm run test:e2e`, `npm run build`, etc.). Sin embargo, el fix final para el test E2E de chat (`tests/e2e/pedido-chat.spec.ts`) es un **workaround temporal**:

- En `next dev` con Turbopack, las rutas `POST` de chat reciben el header `Content-Length` correcto, pero el `Request` de Next.js llega con `request.body === null`.
- Esto provoca que `request.json()` lance `SyntaxError: Unexpected end of JSON input`.
- Para salvar el flujo, el cliente envía `content` como query param y el handler lee el query como fallback.
- La paginación del chat, rate limiting, expiración y autorización con `cancellationToken` ya están implementados.

## Objetivo

Auditar el flujo de chat e implementar las mejoras necesarias para:

1. Eliminar o mitigar el workaround del query param para enviar mensajes.
2. Resolver o investigar los warnings `MaxListenersExceededWarning: 11 drain listeners added to [Gzip]` y `Error: The destination stream closed early` que aparecen durante `npm run test:e2e`.
3. Eliminar o refactorizar la guarda `process.env.NODE_ENV !== 'test'` en `OrderChat`.
4. Revisar la estrategia de polling del chat.
5. Documentar claramente cualquier workaround que deba mantenerse.
6. Asegurar que todos los tests (unitarios, E2E, build, lint y typecheck) sigan pasando.
7. Hacer commit del estado final del flujo si aún no se commiteó.

## Reglas de negocio

1. Un pedido solo puede enviar mensajes mientras esté `pending` y no haya expirado.
2. El `cancellationToken` sigue siendo el mecanismo de autorización del chat público.
3. El cliente y el operador deben ver los mensajes en orden cronológico con paginación conservada.
4. Los adjuntos del chat deben seguir funcionando (`pedido-chat-adjuntos.spec.ts`).
5. No hardcodear URLs, credenciales ni timeouts; usar variables de entorno y configuraciones dinámicas.

## Implementación detallada

### 1. Eliminar el workaround del body vacío en las rutas de chat

Prioridad: alta.

El workaround actual se encuentra en:
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />

<ref_snippet file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" lines="90-105" />
<ref_snippet file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" lines="550-575" />

Tareas concretas:
- Investigar si el bug de `request.body === null` en `next dev` con Turbopack es reproducible en una app mínima con la misma versión de Next.js.
- Si se confirma como bug de Next.js, reportarlo y evaluar subir de versión cuando haya un fix.
- Si no se puede resolver rápido, considerar mover los `POST` de chat a **Pages Router** (`pages/api/...`) para acceder al `IncomingMessage` nativo de Node y evitar el `Request` de App Router en dev.
- Si se mantiene el workaround, el handler debe seguir aceptando tanto JSON body (tests unitarios) como query `content` (E2E en dev), pero el cliente idealmente debe volver a enviar JSON body.

### 2. Investigar warnings de Gzip y streams cerrados

Durante `npm run test:e2e` aparecen:
- `MaxListenersExceededWarning: 11 drain listeners added to [Gzip]`
- `Error: The destination stream closed early`

Archivos a revisar:
- <ref_file file="C:/developer/paginas/pancheria/next.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" />

Tareas concretas:
- Correr `npm run test:e2e` con `compress: false` en `next.config.ts` para descartar que `compress: true` cause los warnings.
- Si desaparecen, evaluar si `compress` es necesario en desarrollo o si se puede deshabilitar solo en dev.
- Si persisten, buscar el handler o middleware que agrega múltiples listeners a streams comprimidos y cerrarlos correctamente.
- Garantizar que los tests E2E sigan pasando tras cualquier cambio.

### 3. Refactorizar la guarda `process.env.NODE_ENV !== 'test'`

Archivo afectado:
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />

<ref_snippet file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" lines="510-520" />

Tareas concretas:
- Reemplazar la guarda por un mecanismo que no ramifique el componente por entorno.
- Opción A: mockear `setInterval`/`setTimeout` en `order-chat.test.tsx` para que el poll inmediato se ejecute dentro de `act`.
- Opción B: usar un flag `disablePollingOnMount` en las props del test.
- Opción C: envolver el `queueMicrotask` de forma que en tests se pueda esperar con `act`/`waitFor`.

### 4. Revisar la estrategia de polling

Archivos afectados:
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/config/chat.ts" />

Tareas concretas:
- Evaluar si el poll inmediato al montar + `pageshow`/`visibilitychange` es suficiente o si se requiere algo más robusto.
- Considerar **Server-Sent Events** (`EventSource`) para reducir requests y latencia.
- Asegurar que `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` siga siendo respetado y configurable.

### 5. Documentar workarounds

Archivos a actualizar:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />

Tareas concretas:
- Si el workaround de query param se mantiene, agregar una nota clara en `AGENTS.md` o `lecciones-aprendidas.md` explicando por qué `content` viaja por query en las rutas de chat.
- Documentar los síntomas del bug (`request.body === null` en dev, `Content-Length` correcto) para que futuros cambios no lo rompan.

### 6. Verificar estado del chat page y SSR

Archivo afectado:
- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/[id]/chat/page.tsx" />

Tareas concretas:
- Revisar si `unstable_noStore`, `force-dynamic`, `revalidate = 0` y `fetchCache = 'force-no-store'` son aún necesarios una vez resuelto el polling.
- Si el polling inmediato es suficiente, simplificar la configuración del segmento.

### 7. Commit del estado final

- Revisar `git status` y hacer un commit limpio con todo el flujo de chat (paginación, rate limit, expiración, fix del body y warning de `useRecentOrders`).
- No incluir `.env.local`, archivos temporales ni `test-results/`.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de APIs ni parámetros sensibles.
- Ejecutar `npm run test:e2e` solo en una base de datos de prueba descartable; `tests/e2e/global-setup.ts` trunca tablas.
- Si se envía `content` por query string, recordar que queda expuesto en logs del servidor, historial del navegador y posibles proxies. Limitar la longitud a `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH` (por defecto 1000 caracteres).
- No commitear `.env.local`.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y calidad |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run test:e2e` | Tests E2E en base de prueba |

## Criterios de aceptación

- El test E2E `tests/e2e/pedido-chat.spec.ts` pasa.
- El test E2E `tests/e2e/pedido-chat-adjuntos.spec.ts` pasa.
- Todos los tests unitarios y el build pasan.
- No hay warnings nuevos de `act(...)` en `order-chat.test.tsx`.
- Los warnings de Gzip/stream desaparecen o están documentados con una causa conocida.
- El código no ramifica por `process.env.NODE_ENV === 'test'`.
- Cualquier workaround que se mantenga está documentado en `AGENTS.md` o `lecciones-aprendidas.md`.
