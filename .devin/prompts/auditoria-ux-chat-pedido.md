# Prompt: Auditoría de UX del chat de pedido — bienvenida, adjuntos, leídos e hidratación

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5. Deploy en Vercel.

El chat del pedido es el **único canal de comunicación con el cliente** (WhatsApp fue eliminado — lección `lecciones-aprendidas.md` §12). Tiene dos superficies: la pública `/pedido/[id]/chat?token=…` (cliente, `isClient`) y la del panel `/pedidos/[id]` (operador). Comparten `OrderChat` + `useOrderChat`.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> — especialmente §10 (chat), §37 (no leer APIs de cliente durante el render), §121 (`useSyncExternalStore` contra hydration mismatch), §122-123 (ubicación por chat), §141 (mensaje automático de `createOrder`) y §186 (los mensajes derivados deciden campos explícitamente).
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/auditoria-chat-ubicacion.md" /> — auditoría resuelta de ubicación por chat; no repetir hallazgos.
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/auditoria-chat-workaround-y-mejoras.md" /> — auditoría resuelta del chat (workaround de body, polling, `force-dynamic`); no repetir hallazgos.
- `.devin/informes/archivados/spike-sse-chat-2026-09-19.md` — decisión SSE opt-in (T13).

Archivos de código de lectura obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" /> — hook central (polling, SSE, read receipts, adjuntos, ubicación).
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-attachment.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/[id]/chat/page.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-chat-section.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderMessageRepository.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`createOrder`, líneas ~288-435) y <ref_file file="C:/developer/paginas/pancheria/src/lib/order-helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/chat-storage.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/storage.ts" /> (firmas de archivo) y <ref_file file="C:/developer/paginas/pancheria/src/config/chat.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/upload/route.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/upload/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/usePedidoDetail.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedidos-list.tsx" /> (badges de no leídos del panel)

## Estado actual verificado (no re-derivar; profundizar y confirmar)

Los cuatro hallazgos siguientes ya fueron confirmados en código con el síntoma reportado por el negocio. La auditoría debe validarlos, evaluarlos de punta a punta y proponer el fix concreto — no redescubrirlos.

### 1. Mensaje automático inicial — frío y parcial

`orderService.createOrder` (`src/application/services/orderService.ts:413-421`) inserta un único mensaje `senderType: 'operator'`, `senderName: 'Sistema'` cuyo contenido arma `buildRecipeSnapshotMessageContent` (`src/lib/order-helpers.ts:89-109`):

```
Detalle de preparación:
{productName} x{quantity}: {formatRecipeSummary(recipeSnapshot)}{ — Aclaración: notes}
```

- Sin saludo, sin total, sin forma de entrega, sin nombre de sucursal: el primer contacto del cliente con el local es un texto operativo.
- Si ningún ítem tiene receta ni nota, `lines` queda vacío → la función devuelve `null` → **no se envía ningún mensaje** (pedido simple = chat completamente mudo al inicio).
- Datos disponibles en `createOrder` para el copy: `customerName`, `deliveryType`, `address`, `orderTotal`, `orderItemValues` (productName, quantity, unitPrice, subtotal, recipeSnapshot, notes) y `branch.name`. `formatMoney` existe en `src/lib/money.ts:57`. Etiquetas públicas vigentes: "Envío a domicilio" / "Retiro en sucursal: {name}" (`pedido-customer-form.tsx:90-98`).
- `formatRecipeSummary` (`src/lib/recipe-helpers.ts:44-57`) incluye `"Sin: X"` (información operativa) mientras `formatSelectedRecipeSummary` (`:65-71`) solo lista lo incluido — decidir explícitamente cuál va en la superficie cliente (lección §186).

### 2. Hydration mismatch en `ChatComposer` (error reproducido en dev)

`useOrderChat.ts:183-188` evalúa **`navigator` durante el render**:

```ts
const canSendClientLocation =
  !isReadOnly &&
  isClient &&
  deliveryType === 'delivery' &&
  typeof navigator !== 'undefined' &&
  'geolocation' in navigator;
```

En SSR es `false`, en el cliente `true` → el botón `chat-client-location-button` (`chat-composer.tsx:93-106`) solo existe en el cliente. El diff reportado en dev (`+ <button … data-testid="chat-client-location-button">` / `- <textarea>`) corresponde exactamente a esta divergencia. Fix esperado según las lecciones §37/§121: `useSyncExternalStore` con `getServerSnapshot = () => false` (patrón vigente en `order-tracker.tsx:64` y `src/hooks/useRecentOrders.ts`), no `useState`+`useEffect` ni `suppressHydrationWarning`.

### 3. Badge "sin leer" persiste con el chat abierto

`markAsRead` (`useOrderChat.ts:444-458`) hace `POST …/chat/leido` pero **nunca actualiza el estado local** `messages`: los mensajes del otro emisor quedan con `readAt: null` en memoria → `unreadFromMessages` (`:196-201`) sigue > 0 → el badge rojo del encabezado (`chat-message-list.tsx:117-121`) queda visible mientras el usuario está mirando los mensajes. El efecto de `:652-670` sí dispara `markAsRead` al llegar mensajes con la pestaña visible, pero sin reflejar `readAt` en local el badge no baja. El badge del listado (`pedidos-list.tsx:454-461`, via `countUnreadByOrderAndSender`) es server-side: verificar si se limpia al re-fetchear y si ambos badges pueden quedar inconsistentes entre sí.

### 4. Pipeline de adjuntos — brechas frente a capturas y comprobantes

- **Cliente sin validación:** `handleFileSelect` (`useOrderChat.ts:755-764`) acepta cualquier archivo; tamaño y tipo solo se rechazan en el servidor tras el upload → error tardío y genérico.
- **`accept` desalineado:** `accept="image/*"` (`chat-composer.tsx:76`) admite GIF/SVG/etc. que el servidor rechaza, y **excluye PDF** — el comprobante de Mercado Pago puede compartirse como imagen o como PDF.
- **`capture="environment"`** (`chat-composer.tsx:77`): en mobile sugiere abrir la cámara directo, dificultando elegir una captura de la galería (caso de uso real: screenshot del comprobante de MP).
- **PDF fail-closed en servidor:** `signatureCheckers` (`src/lib/storage.ts:42-63`) rechaza todo MIME sin firma registrada — `application/pdf` (`%PDF` = `25 50 44 46`) no existe. Además `CHAT_KEY_PATTERN` solo admite `jpg|jpeg|png|webp` (`chat-storage.ts:31`), `getExtension` (`:59-70`) y el mapa de `readChatAttachment` (`:253-258`) no contemplan `.pdf`; el render de no-imagen ya existe (`chat-attachment.tsx:37-41`, Paperclip). La env `NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES` dice "IMAGE" — evaluar si se renombra, se agrega una variable nueva o se amplía la lista con un nombre más general.
- **Tope de plataforma:** `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` default 5 MB (`config/chat.ts:47-59`); en Vercel el body de una función serverless tiene un tope propio (~4.5 MB) → un archivo de 4.6–5 MB moriría con 413 antes de llegar al handler. Marcar como **"verificar en producción"** (depende del plan/infra, no visible en el repo) y evaluar bajar el default, validar en cliente o subida directa a Blob.
- **Adjunto huérfano en el panel:** la ruta pública borra el archivo si `sendClientMessage` falla (`api/public/pedido/[id]/chat/upload/route.ts:84-99`), pero la del panel (`api/pedidos/[id]/chat/upload/route.ts:56-70`) no — si `sendOperatorMessage` lanza después de `saveChatAttachment` (pedido finalizado/expirado), el archivo queda huérfano hasta el cron.
- Validación server-side correcta a reseñar como "lo que está bien": `validateImage` (`chat-storage.ts:72-83`) chequea MIME + tamaño + magic bytes **antes** de escribir; `validateAttachment` (`chatService.ts:111-123`) revalida.

## Dirección de negocio (decisiones ya tomadas — no re-debatir)

1. **Bienvenida en dos mensajes** automáticos al crear el pedido: el primero con saludo personalizado + resumen amigable (ítems pedidos, total, forma de entrega o retiro, y dirección si es delivery); el segundo, el "Detalle de preparación" operativo vigente. La auditoría propone el copy y la superficie de cambio, no redefine la decisión.
2. **El alcance de adjuntos incluye PDF** (los comprobantes de Mercado Pago se comparten como imagen o PDF) salvo que la auditoría documente un blocker técnico concreto.
3. El objetivo transversal es **trato cálido y personal, no genérico**: todo cambio de copy o de flujo se evalúa bajo esa vara (saludo por nombre, lenguaje del local, nada de jerga interna).

## Objetivo

Emitir un informe objetivo de UX del chat de pedido — cliente y operador — con evidencia en el código para cada afirmación, que valide los cuatro hallazgos verificados, mida la superficie de cambio de cada fix y cubra además las secciones de auditoría general. La auditoría es **de solo lectura sobre el código**: no se modifican archivos de negocio.

## Qué auditar (cada hallazgo con evidencia: archivo:línea o nombre de función/exportación)

### A. Mensaje automático y tono

- Confirmar el alcance del mensaje único actual y el caso "sin mensaje" (pedido sin receta ni notas). Verificar todos los puntos donde se inserta mensaje automático (`orderService.ts:413-421`, `sendBranchLocationMessage` en `chatService.ts:477-534`).
- Proponer el copy completo del mensaje 1 (bienvenida) con estas reglas mínimas: saludo con `customerName` (o fallback sin nombre), resumen de ítems con cantidades, `formatMoney(orderTotal)`, forma de entrega ("Envío a domicilio" + `address` / "Retiro en sucursal: {branch.name}"), y cierre que invite a responder por el chat. Evaluar `senderName`: `'Sistema'` vs nombre de la sucursal.
- Decidir si el detalle de preparación conserva `formatRecipeSummary` (con "Sin: X") o se revisa qué ve el cliente (lección §186); el mensaje operativo es leído también por cocina desde el panel.
- Riesgos a evaluar: longitud del mensaje vs `getChatMaxTextLength()` (default 1000), escapado/sanitización de `customerName`/`address` (van a `order_messages.content` y se renderizan con `whitespace-pre-wrap`), y qué pasa con pedidos creados antes del cambio (no migración: solo mensajes nuevos).

### B. Adjuntos end-to-end (cliente → upload → storage → render → cleanup)

- Validación en cliente: qué chequear en `handleFileSelect`/`ChatComposer` (tamaño contra `getChatImageMaxSizeBytes` — ojo: es `NEXT_PUBLIC_*`, verificar que el valor esté disponible en el bundle del cliente — y tipo contra la whitelist efectiva), con mensaje de error claro que mencione el límite vigente y los formatos aceptados.
- `accept` del input: alinearlo con la whitelist real del servidor (y con `.pdf` si se habilita). Evaluar quitar `capture="environment"` o limitarlo — el flujo prioritario del negocio es adjuntar capturas/comprobantes existentes, no fotos en vivo.
- Soporte PDF: superficie exacta del cambio — `signatureCheckers` (`storage.ts:42`), `CHAT_KEY_PATTERN` (`chat-storage.ts:31`), `getExtension` (`:59-70`), mapa de `readChatAttachment` (`:253-258`), `getChatAllowedImageMimeTypes`/`NEXT_PUBLIC_CHAT_ALLOWED_IMAGE_MIME_TYPES` (renombrar vs nueva variable vs lista ampliada — decisión con trade-offs de compatibilidad de env en Vercel), render en `ChatAttachment` (fallback Paperclip vs preview embebido), y serving en `src/app/api/chat/attachment/[key]/route.ts` (Content-Type/Disposition para PDF: ¿inline o descarga?).
- Tope efectivo de tamaño: contrastar `NEXT_PUBLIC_CHAT_IMAGE_MAX_SIZE_MB` con el límite de body de la plataforma de deploy (Vercel — "verificar en producción") y con tamaños reales de capturas/comprobantes MP (típicamente < 2 MB). Recomendar default y validación acordes.
- Huérfanos y cleanup: el `try/catch` de borrado falta en la ruta del panel (`api/pedidos/[id]/chat/upload/route.ts`); verificar que el cron `chat-attachments-cleanup` (`src/application/services/cleanupService.ts`, `src/app/api/cron/chat-attachments-cleanup/route.ts`) cubra claves `.pdf` si se habilitan (`findAllAttachmentKeys`, `findExpiredForTerminalOrders`).
- Seguridad del serving: revisar `src/app/api/chat/attachment/[key]/route.ts` — auth del token, rate limit, headers (CSP, `Content-Disposition`, `X-Content-Type-Options`) para imágenes y PDF.

### C. Read receipts y badges de no leídos

- Confirmar la repro del badge trabado (mensaje entrante con chat visible → POST `/leido` → badge sigue en N). Evaluar el fix: reflejar `readAt` en `messages` locales tras el POST (optimista vs usar la respuesta; `markClientMessagesAsRead`/`markOperatorMessagesAsRead` devuelven count), cuidando no romper `deliveredAt` ni re-renders.
- Consistencia entre las tres superficies de no-leídos: badge del chat (`displayedUnreadCount`), badge del detalle del panel (`usePedidoDetail.ts:148`, server-side) y badge del listado (`pedidos-list.tsx:454-461`). ¿Se limpian todas? ¿Hay polling del listado (`NEXT_PUBLIC_PEDIDOS_REFRESH_INTERVAL_MS`) que las resincronice?
- Casos borde: pestaña oculta (el efecto de `:652-670` no marca leído — comportamiento correcto a preservar), bfcache (`pageshow`), SSE vs polling (los mensajes por stream también deben disparar read receipt), scroll a mensajes viejos no visibles (¿"leído" debe implicar visto o solo recibido en pantalla? — decisión de producto a documentar, WhatsApp marca leído por apertura de conversación).

### D. Hidratación y SSR-safety general del chat

- Confirmar el mismatch de `canSendClientLocation` y buscar **todas** las divergencias render-dependientes de APIs de cliente en `useOrderChat`/`ChatComposer`/`ChatMessageList`/`ChatAttachment` y en la página: `typeof navigator/window`, `EventSource`, `Date.now()`, formato de hora (`formatTime` en `chat-message-list.tsx:179-180` con `initialMessages` SSR — ¿locale/zone consistente?), `capture`, `disabled` derivados de estado mutable.
- Verificar si `canSendBranchLocation` (operador, `deliveryType === 'pickup'` + `branchLocation`) puede divergir igual por datos que llegan por poll (`setDeliveryType`/`setBranchLocation` después de hydration).
- Revisar que el fix recomendado (`useSyncExternalStore` o equivalente) no reintroduzca el patrón prohibido de `setState` en `useEffect` (lección §106 del README de prompts / `lecciones-aprendidas.md`).

### E. UX general y accesibilidad del chat

- Layout: `h-[500px]` fija (`order-chat.tsx:94`) en mobile/desktop — ¿se comporta bien con teclado virtual y viewport chico?; encabezado "Sincronizando..." siempre visible al pollar (`chat-message-list.tsx:122-124`) — ¿ruido visual o útil?
- Estados: vacío ("Todavía no hay mensajes…"), expirado/finalizado (readOnly, placeholder "El pedido no está pendiente."), errores de envío (banner `bg-destructive/15`), 429 de rate limit (qué texto ve el usuario), falla de upload parcial.
- Accesibilidad: labels/`aria-label` de botones icono (adjuntar, ubicación, enviar — `chat-composer.tsx:85,100,115,148`), `aria-live` para mensajes nuevos, contraste del badge destructive y del texto de hora (`text-primary-foreground/70`), tamaño de targets táctiles, foco tras enviar, navegación por teclado del historial.
- Burbujas: `senderName` visible solo con nombre seteado; distinguir 'Sistema'/sucursal de un operador humano; el mensaje de ubicación renderiza "Ver ubicación" (`chat-message-list.tsx:67-83`) — verificar textos y tone consistente.

### F. Reglas de negocio que no deben romperse (checklist de no-regresión)

- Autorización por `cancellationToken` en la superficie pública; `assertClientCanSend` y estados terminales (`finished`/`cancelled`/expirado).
- Rate limits: `createRateLimiter('chat')` en rutas públicas incl. `/leido` y `/upload` (lección §40).
- `markMessagesAsDelivered` solo en lectura del receptor; `readAt` solo vía POST `/leido`.
- Paginación por cursores `before`/`after` y preservación de scroll.
- SSE opt-in (`NEXT_PUBLIC_CHAT_STREAM_ENABLED`) con fallback a polling.
- Tests existentes: `tests/e2e/pedido-chat.spec.ts`, `pedido-chat-adjuntos.spec.ts`, `chat-stream.spec.ts` y los unitarios de `chat/` deben seguir pasando con cualquier fix propuesto.

## Reglas de oro

1. Idioma español en todo: explicaciones, comentarios, documentación e informe.
2. Auditoría de solo lectura: **no modificar archivos de negocio**. Solo se permite crear/editar el archivo de informe en `.devin/informes/` y los índices de `.devin`.
3. Prohibido ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push/generate/migrate`, `npm run test:e2e` ni `npx playwright test` sin confirmación explícita del usuario y base de datos de prueba. Si se quiere demostrar un bug en vivo, `npm run dev` local está permitido sin tocar datos productivos.
4. Nunca hardcodear ni exponer credenciales, URLs de APIs, secretos ni valores de `.env.local`/`.env.e2e` en el informe.
5. Sin hallazgos inventados: cada afirmación con evidencia (`archivo:línea`, `<ref_snippet .../>` o nombre de función). Lo no verificable se marca explícitamente; lo que dependa de infraestructura fuera del repo (plan de Vercel/Neon, límites de plataforma) se lista como "verificar en producción".
6. Clasificar hallazgos en **crítico**, **mayor**, **menor** o **informativo** (convención del proyecto).
7. No repetir hallazgos ya documentados en `reporte-estado.md`, `lecciones-aprendidas.md` ni auditorías archivadas; referenciarlos en vez de re-derivarlos.
8. Todo valor configurable (límites, textos, tamaños) debe venir de env/config existente o de una propuesta de variable nueva justificada — nada hardcodeado (regla global del proyecto).

## Metodología

1. **Preparación:** `git status`, `git log --oneline -20` y `git rev-parse HEAD` para baseline y fecha del informe.
2. **Lectura base:** toda la documentación y archivos obligatorios listados arriba.
3. **Verificaciones base (solo lectura):** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`; documentar resultados. Opcional: levantar `npm run dev` y reproducir en vivo el hydration mismatch y el badge trabado contra la base de desarrollo.
4. **Análisis por secciones:** recorrer A–F con búsquedas dirigidas (`typeof navigator`, `useState`+`useEffect` para APIs de cliente, `accept=`, `capture`, `readAt`, `senderName`, `formData`).
5. **Síntesis:** clasificar hallazgos y armar el plan de implementación recomendado por fases (cada fase autocontenida y mergeable; la fase de copy del mensaje debería ser la primera por impacto/esfuerzo).
6. **Cierre:** escribir el informe, actualizar índices.

## Entregables

1. **Informe** en `.devin/informes/auditoria-ux-chat-pedido-YYYY-MM-DD.md` (archivo fechado, como el resto de auditorías puntuales del proyecto).
2. **Índices actualizados** en el mismo cambio: `.devin/informes/README.md` y el bloque Estructura/Estado de `.devin/README.md` (regla de índices de `.devin/prompts/README.md`).
3. Si el informe deja pendientes accionables, reflejarlos en `reporte-estado.md` o documentar por qué no aplica.

## Formato del informe

1. **Veredicto** (1 párrafo): estado general de la UX del chat y de los cuatro hallazgos verificados.
2. **Cuadro de severidades**: tabla con hallazgo, severidad (🔴/🟡/🟢/⚪), superficie (cliente/operador) y esfuerzo estimado.
3. **Hallazgos detallados**: por cada problema — qué, dónde (`archivo:línea`), por qué afecta la experiencia del cliente, cómo reproducirlo, fix recomendado con archivos a tocar.
4. **Plan de implementación recomendado**: fases ordenadas por impacto/esfuerzo, con copy propuesto del mensaje de bienvenida y la lista exacta de cambios para PDF si procede.
5. **Lo que está bien**: decisiones correctas vigentes (validación con magic bytes, rate limits, cursores, SSE opt-in, etc.).

Encabezado del informe: fecha, baseline (`git rev-parse HEAD`), alcance ejecutado y comandos corridos.

## Criterio de aceptación

- El informe cubre las secciones A–F y respeta el formato.
- Los cuatro hallazgos verificados quedan confirmados o refutados con evidencia.
- Todo hallazgo tiene evidencia concreta o está marcado como "no verificable" / "verificar en producción".
- El plan recomendado respeta la dirección de negocio (dos mensajes, PDF en alcance) o justifica una desviación documentada.
- No se repiten hallazgos ya documentados sin referencia cruzada.
- El informe queda archivado en `.devin/informes/` con índices sincronizados.
- No se modificó código de negocio ni se ejecutaron comandos destructivos.
