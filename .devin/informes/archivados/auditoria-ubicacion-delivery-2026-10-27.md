# Ubicación obligatoria en pedidos delivery — auditoría e implementación

**Fecha:** 2026-10-27
**Estado:** implementado (archivado 2026-10-27) — pusheado en `1603df3`+`2e6504d`, migración `0043_delivery-location` aplicada en producción, CI `40579566454` success (shards E2E 1+2 verdes), deploy `dpl_BYCm3NfPRFXXgakm7J8SnPbv1ZPZ` Ready.
**Prompt origen:** `.devin/prompts/ubicacion-delivery-requerida.md`

## Resumen

El chat es el único canal de comunicación con el cliente y una ubicación compartida opcionalmente por chat no alcanza para operar deliveries con confiabilidad. A partir de esta implementación, todo pedido `delivery` exige un pin de entrega que se persiste en `orders.deliveryLocation` como URL canónica del mapa configurado, se inserta automáticamente en el chat al crear el pedido y se muestra en el panel del operador. Los pedidos `pickup` y los históricos siguen con `deliveryLocation = null`. No hay tracking, geofencing ni stream de posiciones: se guarda una sola URL canónica.

## Fase 1 — Auditoría del flujo de ubicación existente (A–E)

### A. Captura de ubicación del cliente en el chat

- **Mayor (fix aplicado):** el flujo en dos pasos era frágil — `requestClientLocation` hacía `setContent(url)` sobre el compositor: pisaba el borrador, dejaba la URL cruda visible/editable y exigía un segundo clic en "Enviar", asimétrico con `sendBranchLocation` del operador (POST inmediato + mensaje dedicado). **Decisión: envío directo** — tras `getCurrentPosition` el pin se postea como mensaje dedicado por `chatApiUrl` (misma superficie que un mensaje de texto, así que hereda `assertClientCanSend` + rate limit existente). Es el fix más simple que no pierde el draft: elimina los tres problemas de una vez y empareja el patrón del operador. Privacidad: el clic en "Compartir mi ubicación actual" ahora captura **y envía** en una acción (antes había revisión del enlace en el compositor) — el consentimiento sigue siendo explícito y la etiqueta del botón declara el envío. Cubierto por test nuevo (borrador preservado + POST + chip).
- **Menor (fix aplicado):** sin estado de carga ni guard de petición en curso — un doble clic durante los hasta 10 s de `getCurrentPosition` disparaba pedidos paralelos. Se agregó `isRequestingLocationRef` (guard) + `isRequestingLocation` (spinner `Loader2` + disabled en el botón del compositor).
- **Menor (fix aplicado):** los helpers de geolocalización iban a duplicarse entre chat y checkout → `src/lib/geolocation.ts` (`useGeolocationSupport`, `isGeolocationPositionError`, `getGeolocationErrorMessage`).
- **Menor (fix aplicado):** `GeolocationPositionError` no existe como global en jsdom (ni está garantizado en todos los navegadores) — `err instanceof GeolocationPositionError` lanzaría `TypeError`. Reemplazado por un type guard por forma (`code` numérico 1–3).
- **Informativo (contexto inseguro):** en HTTP no-localhost los navegadores modernos no exponen `navigator.geolocation` → `useGeolocationSupport` = false → el botón se oculta (no falla). En un híbrido donde exista pero falle, `getCurrentPosition` rechaza con PERMISSION_DENIED y el mensaje traducido se muestra. Verificar en producción (Vercel es HTTPS, no aplica).
- **Informativo (precisión):** `maximumAge: 60_000` acepta posiciones de hasta 1 min — suficiente para un pin de entrega (no hay tracking); `enableHighAccuracy: true` con `timeout: 10_000` es el presupuesto correcto. No se agrega `watchPosition` (sobre-ingeniería).
- **Informativo:** `useSyncExternalStore` con snapshot SSR `false` ya estaba aplicado (lección §121) — sin hydration mismatch, preservado.

### B. Envío de ubicación de la sucursal por el operador (referencia)

- **Informativo:** `sendBranchLocationMessage` es el patrón espejado por el fix de A: validación server-side (`tryBuildLocationUrl` + `isValidLocationUrl`), restricción a `pickup`, rate limit por `branchId` (`CHAT_BRANCH_LOCATION_RATE_LIMIT_*`) y traducción de embeds con `buildMapViewUrl`.
- **Decisión de producto (no implementado):** permitir al operador enviar la ubicación de la sucursal también en `delivery` ("acá estamos por si querés acercarte") — el canal de corrección del cliente ya cubre la necesidad; no hay caso de uso validado. Documentado, sin implementación.

### C. Renderizado de mensajes de ubicación

- **Mayor (fix aplicado):** `isKnownMapUrl` solo reconocía hosts de los `TEMPLATES` hardcodeados — una URL generada por la propia app sobre `NEXT_PUBLIC_MAPS_BASE_URL` custom renderizaba texto plano, y `lat,lng` escrito a mano también. Ampliada: coordenadas `lat,lng` → chip (`buildMapViewUrl` las canónicamente convierte), y el host de `NEXT_PUBLIC_MAPS_BASE_URL` (+ subdominios) → chip. Falso positivo aceptado y documentado: un mensaje que es solo `número,número` dentro de rango se trata como pin ("2,50" sería chip — ambigüedad deliberada, el prompt lo avala).
- **Decisión (no implementado):** preview embebida dentro de la burbuja (`buildMapEmbedUrl` + iframe). Descartado por simplicidad mobile-first: el chip "Ver ubicación" es un tap y el mapa abre en la app del SO, sin costo de datos del iframe en cada burbuja. Los mensajes con URL de embed siguen funcionando (`buildMapViewUrl` los traduce).

### D. Superficie del operador

- **Resuelto en Fase 2 §5:** `PedidoInfo` muestra `order.deliveryLocation` como "Ubicación de entrega" → "Ver en mapa" (dato propio, no enterrado en el chat).
- **Decisión (no implementado):** indicador "tiene ubicación" en la lista `/pedidos` — el detalle del pedido y el mensaje automático ya lo exponen; agregar una columna/badge al listado es ruido sin necesidad validada.
- **Informativo:** el mensaje automático del pin llega como `senderType: 'client'` (mensaje entrante, izquierda) — renderiza el chip en ambas superficies y cuenta como no leído para el operador, lo cual es deseado: el pin nuevo aparece en el badge.

### E. Semántica, copy y accesibilidad

- **Menor (fix aplicado):** copy ambiguo del botón del chat ("Compartir ubicación" no aclaraba qué ubicación) → "Compartir mi ubicación actual" (aria-label + title). En el checkout: label "Ubicación de entrega", botón "Usar mi ubicación actual para la entrega" y hint que aclara que el pin es el destino y que puede pegarse un enlace si se pide para otro lado (resuelve el hallazgo 6 del prompt).
- **Menor (fix aplicado):** el chip "Ubicación obtenida" del checkout ahora lleva `role="status"` (aria-live) — el éxito de la captura se anuncia a lectores de pantalla; los errores usan `role="alert"`.
- **Informativo (idempotencia UX):** dos envíos intencionales de ubicación = dos mensajes — aceptable y documentado: el chat es el canal de corrección; el guard solo bloquea el doble clic dentro de la misma petición.
- **Informativo:** targets táctiles (`size="icon"` h-10 w-10), `aria-label`/`title`/`data-testid` preservados, foco no se roba tras el envío.

## Fase 2 — Implementación

### Modelo y persistencia

- `orders.deliveryLocation TEXT NULL` — columna nullable agregada en `src/db/schema.ts` con migración `drizzle/0043_delivery-location.sql` (`drizzle-kit generate`, `check` ✓). Pedidos `pickup` y legacy quedan en `NULL`.
- `deliveryLocation` agregado a `Order` (`src/domain/types.ts`), `CreateOrderInput`, `buildOrderValues` (normaliza con `tryBuildLocationUrl` antes de persistir) y la respuesta del `POST /api/public/pedido`.
- El pin entra en el payload hasheado de `idempotency_keys` (`order.create`): cambiar la ubicación produce otra huella; pedidos repetidos con la misma ubicación deduplican como antes.

### API pública

- `orderSchema` (`src/lib/zod-schemas.ts`): `deliveryLocation` opcional en el shape + `superRefine` — `delivery` exige pin válido ("La ubicación de entrega es obligatoria" / "ingresá un enlace de mapa válido"); `pickup` no lo requiere. La autoridad queda en el servidor: un cliente que llame la API directo sin pin recibe 400.
- El `POST` devuelve `deliveryLocation` para que el checkout/dialog muestre el pin persistido.

### Checkout (`/pedido`)

- `DeliveryLocationField` nuevo (`src/components/pedido/delivery-location-field.tsx`): solo visible en `delivery`. Botón "Usar mi ubicación actual" (captura GPS explícita, muestra "Obteniendo ubicación…" mientras corre, traduce errores a español) + input manual "Enlace del mapa" como fallback permanente. Errores accesibles por `data-testid` (`delivery-location-geo-error`, `delivery-location-error`) y chip de éxito `delivery-location-granted` con enlace "Ver en mapa".
- `usePedidoClient`: estado `deliveryLocation`, validación antes del submit (obligatorio + `tryBuildLocationUrl`), `deliveryLocation` en el body del POST, inclusión en `checkoutSignature` (cambiar el pin rota la `Idempotency-Key`) y reset tras crear el pedido. `pickup` no envía el campo.

### Mensaje automático en el chat

- En `createOrder`, dentro de la misma transacción que crea el pedido, se inserta un mensaje automático con la URL canónica del pin (`senderType: 'client'` — es dato provisto por el cliente). El renderer de URLs de mapa lo convierte en chip "Ver ubicación" (`target="_blank" rel="noopener noreferrer"`, `data-testid="chat-location-link"`). `pickup` no recibe este mensaje.

### Panel del operador

- `PedidoInfo` muestra "Ubicación de entrega" con enlace externo "Ver en mapa" (`data-testid="order-delivery-location-link"`) solo para `delivery` con pin — separado de la dirección textual, que sigue generando su enlace de búsqueda. El GET del panel devuelve el `order` completo, así que la propagación fue automática.

## Verificación

- `npm run lint`: 0 errores (1 warning preexistente en `sign-out-client.tsx`).
- `npx tsc --noEmit`: ✓.
- `npm test`: **2454 tests, 209 suites** ✓ — suites nuevas/actualizadas: `zod-schemas` (refine condicional), `order-helpers` (normalización), `orderService` (persistencia + mensaje automático + idempotencia), `use-submit-idempotency-key` (firma con pin), `delivery-location-field` (GPS/manual/errores), `pedido-client` (checkout delivery), `pedido-info` (render condicional), `order-chat` (envío directo + anti-doble-clic + borrador preservado), `maps` (`isKnownMapUrl` ampliado), `chatService`, `pedido-success-dialog`, `orderRepository`.
- `npx drizzle-kit check`: ✓ (migración `0043_delivery-location` consistente).
- `npm run knip`: ✓.
- `npm run build`: ✓.
- E2E: `tests/e2e/pedido-chat.spec.ts` actualizado — el flujo delivery captura el pin por GPS en el checkout (`grantPermissions`+`setGeolocation`), verifica el mensaje automático en el chat, el share directo sin pisar el borrador y "Ubicación de entrega" en el panel; specs nuevos para fallback manual con permiso denegado y para el bloqueo "delivery sin ubicación no crea pedido". Los specs `pickup` quedan intactos (no piden ubicación). **Pendiente de corrida** (regla de oro: requiere `.env.e2e` con base descartable + confirmación del usuario).

## Lección revertida

La lección "Compartir ubicación en el chat sin migrar el esquema" (lecciones §122) queda superada: el pin de entrega sí se persiste ahora en `orders.deliveryLocation` porque el chat como canal único exige una ubicación confiable al momento del pedido, no opcional durante la conversación. Lo demás sigue vigente: sin coordenadas crudas, sin tracking, una sola URL canónica.
