# Prompt: Ubicación obligatoria en pedidos delivery — auditoría del chat e implementación en checkout

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, pedidos públicos y multi-sucursal.

Stack: Next.js 16 (App Router + Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM con PostgreSQL (Neon), NextAuth v5. Deploy en Vercel.

El chat del pedido es el **único canal de comunicación con el cliente** (WhatsApp fue eliminado — `lecciones-aprendidas.md` §12). La ubicación ya puede compartirse por chat desde 2026-09: el cliente con pedido `delivery` envía su posición por `navigator.geolocation` como enlace de mapas, y el operador con pedido `pickup` envía `branch.location` (`lecciones-aprendidas.md` §122-123, informe archivado `auditoria-chat-ubicacion-2026-09-09.md`). Hoy esa ubicación es **opcional y solo vive en el historial del chat**: el checkout no la pide y el panel no la muestra como dato del pedido. El negocio necesita que todo pedido `delivery` llegue con el pin de entrega.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" /> — §12 (chat único canal), §37 (no leer APIs de cliente durante el render), §67 (iframes/CSP de mapas), §121 (`useSyncExternalStore` contra hydration mismatch), §122-123 (ubicación por chat), §141 (mensajes automáticos de `createOrder`), §186 (mensajes derivados deciden campos explícitamente).
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" /> — §7 (flujo de pedidos) y §7.2.1 (compartir ubicación en el chat).
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/checklist-pre-push.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/auditoria-ux-chat-pedido-2026-10-27.md" /> — auditoría ejecutada: bienvenida en dos mensajes, badge de leídos, hydration fix del botón de ubicación (`useSyncExternalStore` ya aplicado en `useOrderChat`), PDF en adjuntos. **No repetir esos hallazgos.**
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/auditoria-chat-ubicacion.md" /> y `.devin/informes/archivados/auditoria-chat-ubicacion-2026-09-09.md` — decisión original (enlace en `content`, sin columnas nuevas). La dirección de negocio de este prompt **modifica** la decisión de no persistir coordenadas: documentar el cambio explícitamente.

Archivos de código de lectura obligatoria:

- Chat: <ref_file file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" />
- Servicios: <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" /> (`sendClientMessage`, `sendBranchLocationMessage`, `assertAcceptsClientMessages`, `listClientMessages`/`listOperatorMessages`) y <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" /> (`CreateOrderInput`, `createOrderRequestHash`, `createOrder` con los mensajes automáticos ~:414-439)
- Mapas: <ref_file file="C:/developer/paginas/pancheria/src/lib/maps.ts" /> (`buildMapCoordinatesUrl`, `buildMapSearchUrl`, `isKnownMapUrl`, `isValidLocationUrl`, `tryBuildLocationUrl`, `buildMapEmbedUrl`, `buildMapViewUrl`, `describeLocationInput`) y <ref_file file="C:/developer/paginas/pancheria/src/config/maps.ts" /> (`NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`, `getMapsFrameOrigins`)
- Checkout público: <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" /> (`handleSubmitCheckout` ~:541-632), <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-customer-form.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/hooks/use-submit-idempotency-key.ts" /> (`checkoutSignature` :76-92), <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />
- API chat: <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" /> y `src/app/api/pedidos/[id]/chat/ubicacion/route.ts`
- Modelo: <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" /> (`orders` :383-436, `branches.location` :149), <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" /> (`Order` :195-214), <ref_file file="C:/developer/paginas/pancheria/src/repositories/orderRepository.ts" /> (`normalizeOrder` :31-45 — propaga columnas por spread)
- Panel: <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-info.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-chat-section.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-detail.tsx" />, `src/components/pedidos/usePedidoDetail.ts`
- Patrón de validación de ubicación en vivo a reutilizar: `src/components/sucursales/branch-form.tsx` (`describeLocationInput` + `branch-location-preview.tsx`)
- Tests: <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido-chat.spec.ts" /> (:95-172 cliente delivery con `context.setGeolocation`/`grantPermissions`, :174-249 operador pickup), `tests/e2e/helpers.ts` (`setBranchLocation`), `src/application/services/chatService.test.ts`, `src/lib/order-helpers.test.ts`

## Estado actual verificado (no re-derivar; profundizar y confirmar)

Los seis puntos siguientes ya fueron confirmados en código. La auditoría debe evaluarlos de punta a punta y proponer fixes concretos — no redescubrirlos.

### 1. El envío de ubicación del cliente es un flujo en dos pasos con UX frágil

`chat-client-location-button` (`chat-composer.tsx:101-114`) → `requestClientLocation` (`useOrderChat.ts:860-892`): `navigator.geolocation.getCurrentPosition` (`enableHighAccuracy: true`, `timeout: 10_000`, `maximumAge: 60_000`) → `buildMapCoordinatesUrl(lat, lng)` → **`setContent(url)`**:

- **Pisa el borrador**: cualquier texto que el cliente estaba escribiendo se pierde sin aviso.
- **La URL cruda queda visible y editable en el textarea**: el cliente ve un enlace feo, puede tocarlo, cortarlo o romperlo antes de enviar.
- **Sin estado de carga**: durante hasta 10 s no hay spinner ni feedback en el botón; el usuario puede tocar repetidamente.
- Requiere un **segundo paso** manual (apretar "Enviar") — asimétrico con el flujo del operador (`sendBranchLocation` envía directo, `useOrderChat.ts:894+`).
- Errores traducidos por `getGeolocationErrorMessage` (`:16-27`): PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT. Geolocalización solo funciona en contexto seguro (HTTPS/localhost).
- El soporte de geolocalización usa `useSyncExternalStore` con snapshot de servidor `false` (`:216-220`) — patrón correcto ya aplicado (lección §121), preservarlo.

### 2. El renderizado de ubicación depende de `isKnownMapUrl`

`ChatMessageContent` (`chat-message-list.tsx:85-98`) muestra el chip `ChatLocationMessage` ("Ver ubicación", `buildMapViewUrl`, `target="_blank" rel="noopener noreferrer"`) **solo si** `isKnownMapUrl(content)` reconoce el host (`maps.ts:119-125`, templates `TEMPLATES` :59-86). Brechas a verificar:

- Una URL construida sobre `NEXT_PUBLIC_MAPS_BASE_URL` custom no matchea ningún `isProviderUrl` → se renderiza como **texto plano** (el propio enlace que genera la app).
- `lat,lng` pegado a mano o un enlace de mapa de otro proveedor (Apple Maps, etc.) tampoco se detecta.
- No hay preview embebida de la ubicación compartida (existe `buildMapEmbedUrl` + orígenes CSP en `getMapsFrameOrigins`, usado en el catálogo para `branch.location`).

### 3. El servidor no valida que un mensaje de ubicación sea una ubicación

El mensaje del cliente viaja como texto plano por `POST /api/public/pedido/[id]/chat` (`route.ts:77-113`): `chatMessageContentSchema` (`zod-schemas.ts:438-445`) solo valida largo (`getChatMaxTextLength`, default 1000) y `sanitizeContent`/`normalizeMessageValues` (`chatService.ts:103-152`) no distinguen ubicación de texto. Es correcto por diseño (cualquier texto es válido), pero la auditoría debe evaluar si conviene un camino tipado para el pin (ver Fase 2 §4).

### 4. El panel no ve el pin: solo busca por la dirección escrita

`PedidoInfo` (`pedido-info.tsx:28-75`) muestra `order.address` + un enlace "Ver en mapa" construido con `buildMapSearchUrl(order.address)` — una **búsqueda de texto**, no el punto exacto que el cliente compartió. La ubicación real queda enterrada en el historial del chat: el repartidor/operador debe abrir el chat y encontrarla. `orders` no tiene columna de ubicación (`schema.ts:383-436`); `Order` (`domain/types.ts:195-214`) tampoco.

### 5. El checkout no captura ubicación

`PedidoCustomerForm` (`pedido-customer-form.tsx:109-119`) solo muestra el input `Dirección` cuando `deliveryType === 'delivery'`. `handleSubmitCheckout` (`usePedidoClient.ts:558-561`) y `orderSchema` (`zod-schemas.ts:286-296`) exigen solo `address` no vacío. No hay geolocalización ni validación de enlace en el alta del pedido.

### 6. "Ubicación actual" ≠ "dirección de entrega"

La geolocalización marca dónde está el **dispositivo** ahora; el cliente puede pedir desde el trabajo para su casa o para un tercero. Hoy el botón dice "Compartir ubicación" sin aclarar qué ubicación. La auditoría debe evaluar el copy y el flujo para que el cliente entienda que el pin es el destino del envío (el fallback manual de la Fase 2 cubre el caso "no estoy ahí").

## Dirección de negocio (decisiones ya tomadas — no re-debatir)

1. **La ubicación es obligatoria para confirmar un pedido `delivery`** desde el checkout, además de la dirección escrita. La `address` **sigue siendo obligatoria** (complementa: piso/depto/referencia que el pin no cubre); la ubicación es el pin exacto para el repartidor.
2. **Fallback manual obligatorio**: si la geolocalización no está disponible, el permiso fue denegado o el contexto no es seguro, el cliente puede pegar un enlace de mapa o `lat,lng` en un input, validado en vivo con `tryBuildLocationUrl`/`isValidLocationUrl` (patrón de `branch-form` con `describeLocationInput`).
3. **Persistencia en `orders`**: columna nueva con la URL canónica de la ubicación de entrega. Además: mensaje automático en el chat al crear el pedido (para que quede en el historial) y visualización en `PedidoInfo` del panel.
4. El botón "Compartir ubicación" del chat se **mantiene** como canal de corrección (pin equivocado, el cliente se movió, actualización posterior al alta).

## Objetivo

Trabajo en dos fases autocontenidas:

- **Fase 1 — Auditoría** del flujo de ubicación por chat (envío, transporte, render, superficie operador, semántica) con evidencia en código, y aplicación de los **fixes acotados** que resulten (son parte de la entrega, no quedan como propuesta).
- **Fase 2 — Implementación** del requisito de ubicación en el checkout `delivery`: captura con geolocalización o enlace manual, persistencia en `orders`, mensaje automático al chat y visualización en el panel.

## Fase 1 — Qué auditar (cada hallazgo con evidencia: `archivo:línea` o nombre de función/exportación)

### A. Captura de ubicación del cliente en el chat

- Confirmar los problemas del hallazgo 1 (draft pisado, URL cruda editable, sin loading, doble paso). Evaluar el fix: envío directo como mensaje dedicado (simétrico a `sendBranchLocation`, que hace `POST` inmediato y agrega `data.message` local) vs. confirmación previa con chip "Ubicación lista para enviar" que no toque el textarea. Decidir y aplicar el más simple que no pierda el draft.
- Estados del botón: loading durante `getCurrentPosition`, disabled durante `isSending`/`isUploading` (ya está), reintentos tras error.
- Verificar comportamiento en contexto inseguro (HTTP no-localhost): `isGeolocationSupported` es `true` pero `getCurrentPosition` falla — ¿el mensaje de error lo comunica? ¿El botón debería ocultarse?
- Precisión: `enableHighAccuracy: true` en mobile vs. delay; `maximumAge: 60_000` acepta posiciones de hasta 1 min — ¿suficiente para delivery? Evaluar `watchPosition` o re-obtención; no sobre-ingenierizar.

### B. Envío de ubicación de la sucursal por el operador (referencia "lo que está bien")

- `sendBranchLocationMessage` (`chatService.ts:477-534`): valida estados terminales/expiración, `deliveryType === 'pickup'`, `branch.location` con `tryBuildLocationUrl` + `isValidLocationUrl`, traduce embeds con `buildMapViewUrl` antes de guardar. Rate limit por `branchId` en `POST /api/pedidos/[id]/chat/ubicacion` (`CHAT_BRANCH_LOCATION_RATE_LIMIT_*`). Reseñar como patrón a espejar.
- Caso borde: ¿debería el operador también poder compartir la ubicación de la sucursal en pedidos `delivery` (p. ej. "acá estamos nosotros por si querés acercarte")? Documentar como decisión de producto — no implementar sin necesidad.

### C. Renderizado de mensajes de ubicación

- Confirmar cobertura de `isKnownMapUrl`: hosts por proveedor, `NEXT_PUBLIC_MAPS_BASE_URL` custom (verificar en código si entra en la detección — hoy no), `raw` provider (su base es OSM, sí detecta), `maps.app.goo.gl`/`goo.gl` short links pegados a mano, coordenadas `lat,lng` en texto.
- Fix esperado: ampliar la detección para que cualquier URL que `buildMapViewUrl`/`tryBuildLocationUrl` produzca (incluido el host de `NEXT_PUBLIC_MAPS_BASE_URL` y coordenadas) renderice el chip; cuidar falsos positivos (un link a `google.com/maps` con búsqueda de texto también es "ubicación" — está bien que sea chip).
- Evaluar preview embebida dentro de la burbuja (`buildMapEmbedUrl` + `<details>` o thumbnail), respetando CSP `frame-src` (`getMapsFrameOrigins`) y el patrón lazy del catálogo — decidir si suma o si el enlace basta (mobile-first, datos móviles).

### D. Superficie del operador

- `PedidoInfo`: tras Fase 2 debe mostrar `order.deliveryLocation` como dato propio (no depender del chat). Auditar también la lista `/pedidos` y el detalle: ¿conviene un indicador "tiene ubicación"?
- Consistencia: el operador ve el pin del cliente como mensaje entrante (izquierda) — verificar que el mensaje automático de Fase 2 renderice el chip en ambas superficies.

### E. Semántica, copy y accesibilidad

- Copy del botón y de los errores: aclarar que es la ubicación **donde se entrega el pedido** ("Usar mi ubicación actual para la entrega", hint de que puede pegar un enlace si pide para otro lado).
- `aria-label`/`title`, targets táctiles, foco tras enviar, `aria-live` si se agrega feedback de "ubicación obtenida".
- Idempotencia UX: si el cliente toca el botón dos veces, ¿dos mensajes de ubicación? (hoy sí — cada send es un mensaje; documentar si es aceptable).

## Fase 2 — Implementación: ubicación requerida en checkout delivery

Orden sugerido (cada paso mergeable solo en conjunto; el cambio es una unidad funcional):

### 1. Modelo de datos

- `orders.deliveryLocation` (`text`, nullable): guarda la **URL canónica** de la ubicación (salida de `tryBuildLocationUrl`), consistente con `branches.location`. Nullable: pedidos `pickup` y legacy no la tienen. Evaluar y descartar `latitude`/`longitude` por duplicar formato — documentar la decisión en el informe.
- `npx drizzle-kit generate` + commitear la migración en `drizzle/` (regla de `AGENTS.md`); aplicar con `npx drizzle-kit migrate` solo en base de desarrollo/descartable.
- `domain/types.ts`: `Order.deliveryLocation: string | null`. `normalizeOrder` propaga por spread (sin cambio de mapeo); verificar `stripIdempotencyHash`/`findChatStreamState` (columns explícitas — no necesita la columna).
- `orderService.ts`: `CreateOrderInput.deliveryLocation?: string | null`; `buildOrderValues` (`order-helpers.ts:18-57`) lo normaliza (trim → `tryBuildLocationUrl` → `null` si inválido); `createOrderRequestHash` (`orderService.ts:152-162`) lo incluye en la huella de idempotencia.
- Repositorio: el insert via `buildOrderValues` cubre la columna; verificar `insertOrderIdempotent` y que `POST /api/public/pedido` la devuelva en la respuesta si el cliente la necesita (tipo `CreatedOrder` en `usePedidoClient.ts:36-51`).

### 2. API pública

- `orderSchema` (`zod-schemas.ts:269-296`): campo `deliveryLocation: z.string().max(500).optional().nullable()`; extender el `.refine` existente a: `deliveryType === 'delivery'` → `address` no vacío **y** `deliveryLocation` presente con `tryBuildLocationUrl(deliveryLocation) !== null` (mensaje: "La ubicación de entrega es obligatoria para envío a domicilio."). El servidor guarda la URL **normalizada**, no el input crudo.
- Sin endpoint nuevo: el submit ya pasa por `createRateLimiter('order', …)` (`api/public/pedido/route.ts:24-28`).

### 3. Checkout (cliente)

- `PedidoCustomerForm`: debajo de `Dirección`, bloque "Ubicación de entrega" (obligatoria):
  - Botón "Usar mi ubicación actual" (`MapPin`), con estados: `idle` → `requesting` ("Obteniendo ubicación…", disabled+spinner) → `granted` (chip de éxito + link "Ver en mapa" con `buildMapViewUrl` para que el cliente confirme el pin) → `error` (mensaje traducido con la misma tabla de `getGeolocationErrorMessage` — extraerla a un helper compartido si se reutiliza).
  - Soporte de geolocalización con `useSyncExternalStore` + snapshot de servidor `false` (mismo patrón que `useOrderChat.ts:216-220` — evaluar extraer `useGeolocationSupported` a `src/hooks/`).
  - Fallback manual siempre disponible: input "o pegá un enlace de mapa / coordenadas" con validación en vivo por `describeLocationInput` (patrón de `branch-form`: error tras `blur`/tocar, sin marcar `invalid` en vacío si todavía no se intentó geolocalizar — ver copy del hint).
  - Copy que resuelva el hallazgo 6: indicar que el pin es el destino del envío.
- `usePedidoClient`: estado `deliveryLocation` + validación en `handleSubmitCheckout` antes del fetch (mensaje claro si falta en delivery); incluir en el body y en `checkoutSignature` (`use-submit-idempotency-key.ts:76-92` — agregar parámetro, mantener compat de firma); resetear junto a `address` tras éxito (:618-624).
- Geolocalización en checkout usa las mismas options que `requestClientLocation` (`enableHighAccuracy`, timeout 10 s, `maximumAge` 60 s) salvo que la auditoría decida ajustarlas — compartir un helper (`src/lib/geolocation.ts`) si hay duplicación real, no por especulación.

### 4. Mensaje automático de chat con el pin

- En `createOrder` (`orderService.ts:414-439`), después de los mensajes vigentes (bienvenida + detalle de preparación), insertar un mensaje `senderType: 'client'` con `content` = URL canónica sola — así `isKnownMapUrl` renderiza el chip "Ver ubicación" en ambas superficies. `senderName`: evaluar `customerName` vs `'Cliente'` (lección §186: decidir explícitamente).
- Efecto deliberado: cuenta como no leído para el operador (badge) — documentar que es deseado (el pin llega como mensaje entrante del cliente).
- Solo para `deliveryType === 'delivery'` con `deliveryLocation` normalizado.

### 5. Panel

- `PedidoInfo` (`pedido-info.tsx`): cuando `order.deliveryType === 'delivery' && order.deliveryLocation`, mostrar "Ubicación de entrega" con enlace `buildMapViewUrl(deliveryLocation)` (`target="_blank" rel="noopener noreferrer"`); mantener el bloque `Dirección` + `buildMapSearchUrl` actual. Evaluar preview embebida con `buildMapEmbedUrl` bajo `<details>` lazy (CSP ya cubre los orígenes — `getMapsFrameOrigins`); decidir por simplicidad.
- Verificar propagación: `usePedidoDetail` → `GET /api/pedidos/[id]` devuelve `order` completo (sin allowlist de columnas, el campo fluye); actualizar el tipo `OrderInfo` de `pedido-info.tsx:7-17`.

### 6. Reglas de negocio que no deben romperse (no-regresión)

- Autorización `cancellationToken` en superficie pública; `assertClientCanSend`; estados terminales/expirado.
- Rate limits existentes (`order`, `chat`, `chat-branch-location`); sin endpoints públicos nuevos sin limiter.
- Idempotencia: misma `idempotencyKey` + mismo payload (ahora incluye `deliveryLocation`) → dedup; payload distinto → 409 (`assertIdempotencyHashMatches`).
- El botón de chat del cliente solo en `delivery`; el de sucursal solo en `pickup` (`useOrderChat.ts:222-232`).
- Pedidos `pickup`: `deliveryLocation` ausente/`null` y sin validación.
- Pedidos legacy sin `deliveryLocation`: el panel no rompe (campo condicionado).
- Tests vigentes: `pedido-chat.spec.ts` (4 tests de ubicación), adjuntos, stream — todos deben seguir verdes.

### 7. Tests

- Unitarios junto a cada módulo: `orderSchema` (delivery sin `deliveryLocation` → error; con enlace/coords válidos → ok; pickup sin ubicación → ok), `buildOrderValues` (normalización: `lat,lng` → URL canónica; input inválido → `null` + refine lo rechaza antes), `createOrder` (mensaje automático de ubicación solo en delivery), `PedidoInfo` (render condicional del enlace), `checkoutSignature`/`handleSubmitCheckout` (firma incluye el campo, validación previa al fetch).
- E2E en `pedido-chat.spec.ts` o spec nuevo: reutilizar `context.setGeolocation({latitude, longitude})` + `context.grantPermissions(['geolocation'])` del test de :95-172 — cubrir (a) checkout delivery con GPS: pedido se crea, chat muestra el chip, `PedidoInfo` muestra "Ver en mapa"/"Ubicación"; (b) permiso denegado → input manual acepta enlace/coords y el pedido se crea; (c) delivery sin ubicación ni enlace → error y no se crea; (d) pickup no exige ni muestra el campo.
- Playwright sin GPS real: el mock es por contexto de navegador (ya usado); el path "no soportado" se cubre por unitario/mocking de `navigator.geolocation`, no por E2E.

### 8. Documentación y privacidad

- Actualizar `guia-funcionamiento-pancheria.md` §7 (paso del checkout) y §7.2.1 (ubicación): la ubicación de entrega ahora se captura en el alta y se persiste en `orders.deliveryLocation`.
- `lecciones-aprendidas.md`: registrar que se revirtió la decisión "no persistir coordenadas" del informe 2026-09-09 (la retención pasa a ser necesaria para la entrega; la columna guarda URL canónica, no stream de posiciones; sin geocercas ni tracking).
- `AGENTS.md`: solo si se agrega variable de entorno nueva (no se espera).
- Ningún dominio de mapas hardcodeado: todo sale de `NEXT_PUBLIC_MAPS_PROVIDER`/`NEXT_PUBLIC_MAPS_BASE_URL` (regla global).

## Reglas de oro

1. Idioma español en todo: código, comentarios, tests, documentación e informe.
2. Migración obligatoria y commiteada en `drizzle/` para el cambio de `orders`; nada de `drizzle-kit push` sin baseline posterior (`scripts/drizzle-baseline.ts`).
3. Prohibido ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit migrate/push`, `npm run test:e2e` ni `npx playwright test` sin confirmación explícita del usuario y base de datos de prueba (`*.test`/`e2e`/… según `global-setup.ts`). Para diagnóstico local `npm run dev` está permitido.
4. Sin dominios, URLs ni claves hardcodeadas: proveedor/base de mapas por env (`NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`); nada de credenciales en código ni en el informe.
5. Sin hallazgos inventados: cada afirmación con evidencia (`archivo:línea` o `<ref_snippet .../>`); lo no verificable se marca explícitamente; lo que dependa de infraestructura (contexto seguro real en producción, HTTPS de Vercel) se lista como "verificar en producción".
6. Clasificar hallazgos de la Fase 1 en **crítico**, **mayor**, **menor** o **informativo** (convención del proyecto).
7. No repetir hallazgos de `auditoria-ux-chat-pedido-2026-10-27.md`, `lecciones-aprendidas.md` ni la auditoría de ubicación archivada; referenciarlos.
8. SSR-safety: ninguna lectura de `navigator`/`window`/geolocalización durante el render; `useSyncExternalStore` para soporte (lección §37/§121).
9. Antes de commitear: consultar `.devin/informes/checklist-pre-push.md`.

## Metodología

1. **Preparación:** `git status`, `git log --oneline -20`, `git rev-parse HEAD` (baseline y fecha del informe).
2. **Lectura base:** toda la documentación y archivos obligatorios listados arriba.
3. **Verificaciones base:** `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run knip`; documentar resultados.
4. **Fase 1:** recorrer A–E con búsquedas dirigidas (`geolocation`, `isKnownMapUrl`, `buildMap`, `deliveryLocation`, `location`); escribir el informe corto; aplicar los fixes acotados aprobados por la evidencia.
5. **Fase 2:** implementar en el orden §1→§8; migración + tests incluidos.
6. **Cierre:** informe final, actualizar índices y docs (§8).

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y calidad |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto |
| `npx drizzle-kit generate` | Generar la migración de `orders.deliveryLocation` |
| `npx drizzle-kit migrate` | Aplicar en base de desarrollo/descartable (con confirmación) |
| `npm run test:e2e` | Solo con `.env.e2e` y base descartable, con confirmación |

## Entregables

1. **Informe** en `.devin/informes/auditoria-ubicacion-chat-YYYY-MM-DD.md` con los hallazgos de la Fase 1 clasificados y los fixes aplicados (archivo fechado, como el resto de auditorías puntuales).
2. **Código**: fixes de la Fase 1 + implementación completa de la Fase 2 con migración commiteada en `drizzle/`.
3. **Tests** unitarios y E2E nuevos/actualizados, suite en verde.
4. **Documentación**: `guia-funcionamiento-pancheria.md`, `lecciones-aprendidas.md` (decisión de persistencia), índices de `.devin` al día.
