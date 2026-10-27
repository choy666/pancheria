# Auditoría de UX del chat de pedido — informe de implementación

**Fecha:** 2026-10-27
**Estado:** en curso — implementado y verificado localmente (lint, tsc, jest, build, knip ✓); pendiente de commit/PR y de la corrida E2E.
**Prompt origen:** `.devin/prompts/auditoria-ux-chat-pedido.md`

## Resumen

Los cuatro hallazgos pre-verificados del prompt quedaron implementados: el chat ahora abre con una bienvenida cálida en dos mensajes, el badge de no leídos se apaga al leer, el hydration mismatch del botón de ubicación está corregido y los adjuntos aceptan PDF con validación temprana en el cliente. Verificación: **2423 tests unitarios ✓**, `npx tsc --noEmit` ✓, `npm run lint` ✓, `npm run build` ✓, `npm run knip` ✓.

## H1. Mensaje automático — bienvenida en dos mensajes

**Antes:** `orderService.createOrder` insertaba un único mensaje `'Sistema'` con el detalle de preparación, y solo cuando había receta o notas — un pedido simple arrancaba el chat en silencio.

**Implementado:**

- `buildOrderWelcomeMessageContent` (`src/lib/order-helpers.ts`): saludo con `customerName` (fallback `¡Hola!`), "Recibimos tu pedido en {sucursal}", lista `- producto xN`, `Total: {formatMoney(total)}`, línea de entrega (`envío a domicilio` con dirección, o `retiro en {sucursal}`) y cierre invitando a escribir por el chat. El contenido se recorta a `getChatMaxTextLength()` (default 1000).
- `createOrder` inserta el mensaje de bienvenida **siempre** (con `senderName = branch.name`, así el cliente ve el nombre del local y no "Sistema") y después el "Detalle de preparación" con remitente `'Sistema'` solo cuando hay receta/notas — se preserva `formatRecipeSummary` con "Sin: X" porque es superficie operativa compartida con cocina (lección §186).
- Idempotencia intacta: ambos inserts van dentro de la transacción de `createOrder`, que retorna temprano en reintentos duplicados — los tests de dedup/conflicto siguen asertiendo 0 mensajes.
- Cubierto por tests nuevos en `order-helpers.test.ts` (copy, fallback de nombre, dirección, tope de longitud).

## H2. Hydration mismatch en el botón de ubicación

**Antes:** `canSendClientLocation` evaluaba `navigator.geolocation` durante el render → `false` en SSR, `true` en cliente → el `<button>` solo existía en el cliente (el error pegado en `/pedido/[id]/chat`).

**Implementado:** `useSyncExternalStore(subscribeToNothing, getGeolocationSnapshot, getGeolocationServerSnapshot)` con snapshot de servidor `false` — mismo patrón que `order-tracker.tsx` (lección §121). El primer render del cliente es idéntico al SSR y el botón aparece al hidratar. Sin `window`/`Date.now()`/`Math.random()` en render.

## H3. Badge de no leídos trabado

**Antes:** `markAsRead` hacía `POST …/chat/leido` pero nunca tocaba el estado local: `unreadFromMessages` seguía contando mensajes ya vistos y el badge rojo del encabezado quedaba prendido mientras el usuario miraba el chat.

**Implementado:**

- Tras un POST exitoso, `markAsRead` marca `readAt` en los mensajes del otro emisor en el estado local → el badge se apaga al instante (no espera al próximo poll).
- Se registra un scroll intent `preserve` antes del `setMessages`: marcar leído no salta al fondo si el usuario está leyendo mensajes viejos.
- `mergeMessages` (append/prepend) conserva `readAt`/`deliveredAt` ya conocidos: ambos son monótonos (null → timestamp), así una respuesta de poll en vuelo anterior al commit del POST ya no reactiva el badge.
- Las llamadas al `markAsRead` dentro de efectos van por `queueMicrotask` (patrón ya usado con `loadInitialMessages`) para cumplir `react-hooks/set-state-in-effect`.
- El badge del listado del operador (`pedidos-list.tsx`, server-side) no se tocó: se limpia solo al re-fetchear pedidos.

## H4. Adjuntos — validación temprana y soporte PDF

**Implementado:**

- **Cliente:** `handleFileSelect` rechaza tipo no permitido (`file.type` resuelto y fuera de `getChatAllowedImageMimeTypes()`) y archivos sobre `getChatImageMaxSizeBytes()`, con mensaje en español antes de subir; resetea el input para poder re-elegir. Si el navegador no resuelve el MIME, pasa y decide el servidor (sigue siendo autoritativo).
- **Input:** `accept` ahora se genera desde la config (`getChatAllowedImageMimeTypes().join(',')`) y se quitó `capture="environment"` — en mobile ya no fuerza la cámara y permite elegir captura de galería o el PDF que Mercado Pago comparte por su opción nativa de compartir. `aria-label` actualizado a "Adjuntar archivo".
- **PDF:** `application/pdf` sumado a los defaults de `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES`, firma mágica `%PDF` en `storage.ts`, extensión `.pdf` en `getExtension`, patrón de key `pdf` en `CHAT_KEY_PATTERN` y mapeo de MIME en `readChatAttachment` (storage local). El nombre de la variable de entorno se conserva por compatibilidad con despliegues existentes.
- **Preview:** el composer renderiza vista previa con `next/image` solo para `image/*`; para PDF muestra un chip genérico con `FileText` + nombre (un blob PDF rompería el `<Image>`).
- **Render del mensaje:** `ChatAttachment` ya trataba los no-imagen como adjunto genérico (paperclip + link en pestaña nueva) — sin cambios.
- **Huérfanos:** la ruta del operador (`/api/pedidos/[id]/chat/upload`) ahora borra el adjunto guardado si `sendOperatorMessage` falla después del upload (la ruta pública ya lo hacía). Test nuevo cubre el rollback.
- **Config:** `getChatImageMaxSizeMb` exportado para el mensaje de error del cliente; el tamaño sigue 100% configurable por `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` — sin límites hardcodeados.

## Verificación

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit` | ✓ |
| `npm run lint` | ✓ (1 warning preexistente en `sign-out-client.tsx`, ajeno) |
| `npm test` | ✓ 2423 tests, 207 suites |
| `npm run build` | ✓ |
| `npm run knip` | ✓ |
| `npm run test:e2e` | **No corrido** — requiere `.env.e2e` con base descartable; el spec `pedido-chat-adjuntos.spec.ts` usa `setInputFiles` (ignora `accept`) y sube PNG, por lo que no necesitó cambios |

Tests nuevos/actualizados: `order-helpers.test.ts` (welcome builder), `chat-storage.test.ts` (guardado + lectura MIME de PDF), `config/chat.test.ts` (default con PDF), `order-chat.test.tsx` (badge que se apaga, rechazo por tamaño y por tipo) y `pedidos/[id]/chat/upload/route.test.ts` (borrado de huérfano).

## Límite de tamaño verificado — resuelto

- **Tope de body de Vercel (verificado en docs oficiales):** las Functions cortan el body de la request en **4.5 MB** con `413 FUNCTION_PAYLOAD_TOO_LARGE` — es un límite de infraestructura, no configurable por plan. Con el default viejo de 5 MB un adjunto válido para la app moría con un 413 genérico antes de llegar a la ruta. **Decisión aplicada:** default de `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` bajado a **4 MB** — cubre capturas y comprobantes de MP sobradamente y deja ~0.5 MB de margen para el overhead multipart. Si algún día se necesitan adjuntos >4.5 MB, la vía es upload directo del cliente al storage (`@vercel/blob/client` con `handleUpload`), no subir la variable — quedó documentado en `src/config/chat.ts`, `.env.example` y `AGENTS.md`.
- **Flujo "compartir" de Mercado Pago:** la ruta natural en Android/iOS es compartir → guardar a archivos/galería → adjuntar en el chat. Validar en dispositivo real que el picker ahora ofrezca archivos (antes forzaba cámara por `capture`).
- **SSE:** el stream replica los mensajes por `replace`; los campos nuevos (`readAt` local) se reconcilian con el snapshot del servidor igual que el poll — sin cambios de protocolo.

## Archivos tocados

`src/lib/order-helpers.ts` (+test) · `src/application/services/orderService.ts` · `src/components/chat/useOrderChat.ts` · `src/components/chat/chat-composer.tsx` · `src/components/chat/order-chat.test.tsx` · `src/config/chat.ts` (+test) · `src/lib/storage.ts` · `src/lib/chat-storage.ts` (+test) · `src/app/api/pedidos/[id]/chat/upload/route.ts` (+test) · `.env.example` · `AGENTS.md` · `.devin/informes/lecciones-aprendidas.md` (§141).

## Pendientes

- Correr `npm run test:e2e` con `.env.e2e` en base descartable (o dejar que lo cubra CI al abrir el PR).
- Validar en dispositivo real el flujo "compartir" de Mercado Pago (picker de archivos sin `capture`).
- Al mergear: archivar este informe en `informes/archivados/` junto con el prompt `auditoria-ux-chat-pedido.md` en `prompts/archivados/`, y actualizar `reporte-estado.md` §0.
