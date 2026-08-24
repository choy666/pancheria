# ARCHIVADO — Plan de implementación — Chat de pedidos

> **Estado: resuelto / obsoleto.** Las fases de este plan ya se aplicaron: el cliente envía JSON body, el workaround de query param fue eliminado, la compresión se maneja en `NODE_ENV=test` y el polling usa `disablePollingOnMount`. Para el estado actual ver `.devin/informes/reporte-estado.md`, `.devin/informes/lecciones-aprendidas.md` y `.devin/informes/guia-funcionamiento-pancheria.md`.
>
> Plan derivado de la auditoría del prompt `.devin/prompts/archivados/auditoria-chat-workaround-y-mejoras.md`.
> Este documento cubre el workaround del body vacío, warnings de Gzip/streams, la guarda `process.env.NODE_ENV !== 'test'`, la estrategia de polling y el commit final del flujo de chat.

## Decisiones de alcance

| Tema | Decisión |
| --- | --- |
| Base de datos E2E | Usar `.env.e2e` con una base de datos descartable; ver `AGENTS.md` y `.devin/informes/reporte-estado.md` vigente. |
| Workaround del body | Probar actualizar Next.js a la última 16.x en rama aparte; si el bug persiste, migrar `POST` de chat a Pages Router. |
| SSE | Profundizar como análisis técnico y dejar para iteración futura. |
| Persistencia del plan | Este archivo. |

---

## Fase 0: Preparación y seguridad

**Objetivo:** dejar el repo limpio y poder correr E2E sin sorpresas.

| Paso | Acción | Archivos / comandos |
| --- | --- | --- |
| 0.1 | Verificar que `tests/e2e/global-setup.ts` trunca tablas de negocio y que `.env.local` apunta a la base de desarrollo. | `.env.local`, `tests/e2e/global-setup.ts` |
| 0.2 | Hacer un commit de respaldo con el estado actual del flujo de chat. | `git status`, `git add`, `git commit` |
| 0.3 | Correr `npx drizzle-kit push` y `npx tsx src/db/seeds.ts` si la base no está migrada o se truncó. | `package.json` scripts |

**Criterio de salida:** `npm run test:e2e` puede correr contra la base de desarrollo sin riesgo de datos reales.

---

## Fase 1: Refactorizar la guarda `process.env.NODE_ENV !== 'test'`

**Objetivo:** eliminar la ramificación por entorno en un Client Component.

| Paso | Acción | Archivos |
| --- | --- | --- |
| 1.1 | Agregar prop `disablePollingOnMount?: boolean` en `OrderChatProps`. | `src/components/chat/order-chat.tsx` |
| 1.2 | Reemplazar `process.env.NODE_ENV !== 'test'` por `!disablePollingOnMount`. | `src/components/chat/order-chat.tsx` |
| 1.3 | En `order-chat.test.tsx`, pasar `disablePollingOnMount` donde corresponda. | `src/components/chat/order-chat.test.tsx` |
| 1.4 | En `pedido-detail.tsx` y `page.tsx` del chat público, no pasar la prop (usa el default `false`). | `src/components/pedidos/pedido-detail.tsx`, `src/app/(public)/pedido/[id]/chat/page.tsx` |
| 1.5 | Correr `npm test -- order-chat.test.tsx` y ajustar si hay warnings de `act(...)`. | terminal |

**Criterio de salida:** `npm test` pasa, no hay `process.env.NODE_ENV === 'test'` en `src/components/chat`, y no hay nuevos warnings de `act`.

---

## Fase 2: Robustecer y testear el fallback de query param

**Objetivo:** garantizar que el workaround siga funcionando y quede documentado con cobertura.

| Paso | Acción | Archivos |
| --- | --- | --- |
| 2.1 | Agregar tests unitarios en `route.test.ts` de ambos endpoints que envíen `POST` con `?content=` y body vacío. | `src/app/api/public/pedido/[id]/chat/route.test.ts`, `src/app/api/pedidos/[id]/chat/route.test.ts` |
| 2.2 | Agregar test que envíe `POST` sin body y sin query, esperando `400`. | mismos archivos |
| 2.3 | Verificar que `chatMessageContentSchema` acepta el contenido del query param. | `src/lib/zod-schemas.ts` |
| 2.4 | Asegurar que `NEXT_PUBLIC_CHAT_MAX_TEXT_LENGTH` limite el contenido del query param. | `src/config/chat.ts`, `src/application/services/chatService.ts` |
| 2.5 | Documentar el workaround en `AGENTS.md` y `lecciones-aprendidas.md`. | docs |

**Criterio de salida:** los tests del fallback pasan, el workaround está documentado, y `npm test` sigue verde.

---

## Fase 3: Eliminar o mitigar el workaround del body vacío

**Objetivo:** volver a enviar JSON body desde el cliente de forma confiable.

### 3.1 Opción A — actualizar Next.js (primera prueba)

| Paso | Acción | Archivos |
| --- | --- | --- |
| 3.1.1 | Crear rama de prueba. | git |
| 3.1.2 | Actualizar `next` a `16.3.1` o a la última estable de la serie 16.x. | `package.json`, `package-lock.json` |
| 3.1.3 | Limpiar `.next` y `node_modules/.cache`. | `rm -rf .next` |
| 3.1.4 | Correr `npm run dev` y probar enviar un mensaje en el chat. | `npm run dev` |
| 3.1.5 | Correr `npm run test:e2e` específicamente `pedido-chat.spec.ts`. | E2E |
| 3.1.6 | Si funciona, consolidar el upgrade. Si no, descartar rama y pasar a Opción B. | — |

### 3.2 Opción B — migrar `POST` de chat a Pages Router

| Paso | Acción | Archivos |
| --- | --- | --- |
| 3.2.1 | Crear `pages/api/public/pedido/[id]/chat.ts` con `NextApiRequest`/`NextApiResponse`. | nuevo |
| 3.2.2 | Crear `pages/api/pedidos/[id]/chat.ts` para el panel. | nuevo |
| 3.2.3 | Copiar la lógica de rate limit, validación de token/sesión y llamada a `chatService`. | nuevos archivos |
| 3.2.4 | Actualizar `src/config/api.ts` para mantener las mismas URLs (Pages Router tiene prioridad si existe archivo físico con la misma ruta). | `src/config/api.ts` |
| 3.2.5 | Probar en `next dev` que `req.body` llega correctamente. | `npm run dev` |
| 3.2.6 | Actualizar `OrderChat` para enviar JSON body en vez de query param. | `src/components/chat/order-chat.tsx` |
| 3.2.7 | Eliminar o simplificar el fallback en App Router una vez validado. | `src/app/api/.../route.ts` |

### 3.3 Opción C — mantener workaround documentado

| Paso | Acción | Archivos |
| --- | --- | --- |
| 3.3.1 | Dejar el fallback en App Router y mantener el query param. | `src/app/api/.../route.ts` |
| 3.3.2 | Actualizar `AGENTS.md` y `lecciones-aprendidas.md` con la decisión. | docs |

**Criterio de salida:** el cliente envía JSON body, los tests E2E de chat pasan, o el workaround documentado queda como fallback aceptado.

---

## Fase 4: Diagnosticar y resolver warnings de Gzip/streams

**Objetivo:** eliminar `MaxListenersExceededWarning: 11 drain listeners added to [Gzip]` y `Error: The destination stream closed early`.

| Paso | Acción | Archivos / comandos |
| --- | --- | --- |
| 4.1 | Correr `npm run test:e2e` y capturar logs completos. | terminal |
| 4.2 | Probar `compress: false` en `next.config.ts` solo para `NODE_ENV=test`. | `next.config.ts` |
| 4.3 | Si los warnings desaparecen, decidir si dejar `compress: true` en producción y `false` en dev/test. | `next.config.ts` |
| 4.4 | Si persisten, revisar `withApiErrorHandling` y `src/lib/api-handler.ts` para detectar streams no cerrados o múltiples listeners. | `src/lib/api-handler.ts` |
| 4.5 | Buscar en logs si el warning viene de `/api/videos/[id]/stream` o de rutas chat. | `test-results/` |
| 4.6 | Documentar la causa y la solución en `lecciones-aprendidas.md`. | docs |

**Criterio de salida:** `npm run test:e2e` pasa sin warnings nuevos de Gzip/stream.

---

## Fase 5: Revisar polling, SSR y opcional SSE

**Objetivo:** asegurar que la estrategia de refresco sea robusta, configurable y documentar si SSE aplica.

### 5.1 Polling actual

El polling actual usa `setInterval` con `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` (5s por defecto), más disparadores inmediatos en `pageshow` y `visibilitychange`. Es suficiente para un chat de comida rápida con pedidos de corta duración.

### 5.2 SSR del chat público

| Paso | Acción | Archivos |
| --- | --- | --- |
| 5.2.1 | Evaluar si `unstable_noStore`, `force-dynamic`, `revalidate = 0` y `fetchCache = 'force-no-store'` son necesarios. | `src/app/(public)/pedido/[id]/chat/page.tsx` |
| 5.2.2 | Si el polling inmediato cubre la experiencia, simplificar las directivas del segmento. | `src/app/(public)/pedido/[id]/chat/page.tsx` |
| 5.2.3 | Verificar que `NEXT_PUBLIC_CHAT_REFRESH_INTERVAL_MS` siga respetado. | `src/config/chat.ts` |

### 5.3 Server-Sent Events (SSE) — análisis y consejos

SSE permite al servidor enviar mensajes al cliente sobre una conexión HTTP persistente, evitando el polling. Sin embargo, para este proyecto **no se recomienda implementar SSE en esta iteración** por las siguientes razones:

1. **Arquitectura serverless:** Vercel y la mayoría de los entornos serverless tienen un límite de duración por invocación. Una conexión SSE para chat puede durar minutos u horas, lo cual no encaja con funciones serverless de corta vida.
2. **Escalabilidad:** cada pestaña abierta del chat mantendría una conexión persistente. Con muchos clientes, se multiplican las invocaciones y el costo sube.
3. **Manejo de reconexión:** SSE requiere lógica de reconexión, backoff, `Last-Event-ID` y manejo de `EventSource` en el cliente. Añade complejidad que no justifica el ahorro de requests en este caso de uso.
4. **Infraestructura alternativa:** si en el futuro se requiere chat en tiempo real, es más práctico evaluar servicios gestionados como Pusher, Ably, PubNub o WebSockets con un backend de soporte, en lugar de SSE casero sobre funciones serverless.
5. **Caso de uso:** los pedidos son transacciones de corta duración (1 hora máximo). Polling cada 5s es aceptable y suficiente para notificar confirmación/cancelación y nuevos mensajes.

**Recomendación:** dejar SSE como análisis de arquitectura para una iteración futura si el volumen de chat crece significativamente o se requiere true real-time. En esta iteración, optimizar el polling existente con backoff de errores y simplificación de SSR.

**Criterio de salida:** la página sigue funcionando, el polling es configurable, y no hay directivas de cache innecesarias.

---

## Fase 6: Commit y verificaciones finales

**Objetivo:** dejar el repo limpio y verificado.

| Paso | Acción | Comandos |
| --- | --- | --- |
| 6.1 | Revisar `git status` y armar un commit coherente del flujo de chat. | `git status`, `git diff` |
| 6.2 | Excluir `.env.local`, `.env.e2e`, `test-results/` y `tmp/` del commit. | `.gitignore` |
| 6.3 | Redactar mensaje de commit siguiendo el formato del proyecto. | `git commit` |
| 6.4 | Correr verificaciones finales: | — |
|  | a. `npx tsc --noEmit` |  |
|  | b. `npm run lint` |  |
|  | c. `npm test` |  |
|  | d. `npm run build` |  |
|  | e. `npm run test:e2e` |  |
| 6.5 | Actualizar `AGENTS.md` y `lecciones-aprendidas.md` con las decisiones finales. | docs |

**Criterio de salida:** todos los comandos pasan, el commit está hecho, y la documentación refleja el estado final.

---

## Recomendación sobre la estrategia del body

Investigué los issues de Next.js relacionados con el bug. No hay confirmación de que `16.3.1` o `16.4` solucionen el problema de `request.body === null` en App Router con Turbopack. Por eso el plan propone:

1. **Primero** probar el upgrade a la última 16.x en una rama aparte. Es lo más fácil y rápido.
2. **Si falla**, migrar solo los `POST` de chat a Pages Router. Es la solución confiable porque `NextApiRequest` da acceso al `IncomingMessage` nativo de Node, sin la abstracción de `Request` que falla en Turbopack.
3. **Si Pages Router introduce fricción inesperada**, mantener el fallback de query param documentado.

Esto balancea el esfuerzo: lo fácil primero, lo robusto como respaldo.
