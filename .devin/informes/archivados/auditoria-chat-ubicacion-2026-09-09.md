# Auditoría: compartir ubicación por el chat de pedidos

Fecha: 2026-09-09
Auditor: Devin
Prompt de referencia: <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-chat-ubicacion.md" />

## 1. Resumen ejecutivo

Hoy **no es posible compartir la ubicación de forma estructurada por el chat integrado**. El único mecanismo disponible es que el cliente o el operador copien y peguen manualmente un enlace de mapas en el campo de texto.

## 2. Evidencia de capacidad actual

### 2.1 Modelo de datos

La tabla `order_messages` solo soporta texto e imágenes adjuntas. No tiene campos de ubicación ni un tipo de mensaje:

<ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="450-482" />

El tipo `OrderMessage` en <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" /> refleja exactamente las mismas columnas: `content`, `attachmentUrl`, `attachmentKey`, etc. No hay `latitude`, `longitude`, `locationUrl` ni `messageType`.

Los pedidos tampoco tienen coordenadas estructuradas. `orders.address` es un campo de texto libre:

<ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="306-330" />

La sucursal guarda `location` como texto libre en `branches.location`:

<ref_snippet file="C:/developer/paginas/pancheria/src/db/schema.ts" lines="85-96" />

### 2.2 Backend

Los endpoints de chat solo aceptan `content` (texto). El schema de Zod `chatMessageContentSchema` valida únicamente un string:

<ref_snippet file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" lines="291-298" />

`chatService.sendClientMessage` y `sendOperatorMessage` reciben `SendMessageInput` con `content` y `attachment`; no existe un objeto de ubicación:

<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" lines="30-34" />

<ref_snippet file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" lines="99-126" />

Las rutas `POST` de chat usan exclusivamente `content`:

<ref_snippet file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" lines="69-104" />

<ref_snippet file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" lines="50-78" />

### 2.3 Frontend

`ChatComposer` solo muestra un `<Textarea>` para texto y un input de archivo para imágenes. No hay botón ni llamada a `navigator.geolocation`:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" lines="62-113" />

`ChatMessageList` renderiza `content` como texto plano y `ChatAttachment` para imágenes. No hay representación especial de ubicación:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" lines="134-141" />

`useOrderChat` envía o bien `content` como JSON o un archivo en `FormData`; no tiene un modo de ubicación:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" lines="478-517" />

### 2.4 Sucursal y pedido

El formulario de sucursal (`branch-form.tsx`) permite guardar `location` como "URL del mapa o coordenadas":

<ref_snippet file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" lines="204-213" />

Ese mismo enlace se muestra en la página pública y en el diálogo de éxito del pedido, **pero fuera del chat**:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" lines="94-103" />

<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedido/pedido-success-dialog.tsx" lines="167-178" />

`PedidoInfo` en el panel muestra la dirección del cliente como texto plano, sin enlace a mapa:

<ref_snippet file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-info.tsx" lines="51-55" />

### 2.5 Configuración y dependencias

No existen variables de entorno, helpers ni librerías para geolocalización o mapas. Una búsqueda en `src/` no encontró `navigator.geolocation`, `getCurrentPosition`, `openstreetmap`, `google.com/maps`, `mapbox`, `waze` ni similares.

### 2.6 Tests

`chatService.test.ts` y `order-chat.test.tsx` cubren solo mensajes de texto. `tests/e2e/pedido-chat.spec.ts` valida el intercambio de mensajes entre cliente y operador, pero no incluye ubicación.

## 3. Brechas identificadas

| Orden | Brecha | Archivos afectados |
| ----- | ------ | ------------------ |
| 1 | `order_messages` no tiene tipo de mensaje ni campos de ubicación. | <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" /> |
| 2 | `chatMessageContentSchema` y los `POST` de chat solo aceptan `content`. | <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" /> |
| 3 | `sendClientMessage`/`sendOperatorMessage` no aceptan ubicación. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" /> |
| 4 | `ChatComposer` no tiene botón de geolocalización. | <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" /> |
| 5 | `ChatMessageList`/`ChatAttachment` no renderizan mensajes de ubicación. | <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-attachment.tsx" /> |
| 6 | `orders.address` y `branches.location` son texto libre, sin validación de URL ni coordenadas. | <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" /> |
| 7 | `PedidoInfo` no convierte la dirección en enlace a mapa. | <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-info.tsx" /> |
| 8 | No hay variables de entorno ni helpers de mapas. | <ref_file file="C:/developer/paginas/pancheria/src/config/chat.ts" />, <ref_file file="C:/developer/paginas/pancheria/.env.example" /> |
| 9 | No hay tests de ubicación. | <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.test.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.test.tsx" />, <ref_file file="C:/developer/paginas/pancheria/tests/e2e/pedido-chat.spec.ts" /> |

## 4. Alternativas de implementación

| Opción | Descripción | Pros | Contras | Impacto en código |
| ------ | ----------- | ---- | ------- | ----------------- |
| **A — Enlace con coordenadas** | Cliente usa `navigator.geolocation.getCurrentPosition` y envía un mensaje de texto con un enlace a Google Maps / OpenStreetMap (`lat,lng`). | Sin migración, sin costos, rápido, no almacena coordenadas. | Requiere permiso del usuario, menos semántica, abre otra app. | `ChatComposer` (botón + geolocación), `ChatMessageList` (detectar/renderizar URL de mapa). |
| **B — Mensaje estructurado** | Agregar `latitude`, `longitude`, `locationUrl` y/o `messageType` a `order_messages`. | Semántica clara, extensible a mapas estáticos/embebidos. | Requiere migración, cambios en schema, tipos, Zod, servicios y componentes; aumenta retención de datos. | `src/db/schema.ts`, migración, `src/domain/types.ts`, `chatService.ts`, Zod, `ChatComposer`, `ChatMessageList`. |
| **C — Imagen estática** | Generar imagen con Google Static Maps / Mapbox / OpenStreetMap y adjuntarla como imagen. | Se ve directamente en el historial. | Requiere API key, costo, no interactiva, más almacenamiento. | Proveedor, generación de imagen, `ChatAttachment`, variables de entorno. |
| **D — Reutilizar `branch.location`** | El operador envía el enlace guardado en `branches.location`. | Campo existente, sin geolocalización del cliente, sin migración. | Texto libre; requiere validación de URL; manual si no se automatiza. | `branchService.ts`, `chatService.sendOperatorMessage`, botón en el panel, `ChatMessageList`. |

## 5. Recomendación final

Implementar una **combinación de Opción A (cliente en delivery) + Opción D (operador en pickup)** como solución mínima viable.

- **Cliente con pedido `delivery`:** agregar un botón de ubicación en `ChatComposer` que use `navigator.geolocation.getCurrentPosition`, confirme la posición con el usuario y envíe un mensaje de texto con un enlace del tipo `https://www.google.com/maps/search/?api=1&query=lat,lng` o `https://www.openstreetmap.org/?mlat=lat&mlon=lng`. No requiere migración de base de datos ni claves de API.
- **Operador con pedido `pickup`:** agregar un botón que envíe el valor de `branches.location` del pedido, validado previamente como URL. Si no está configurado, el botón debe estar deshabilitado o mostrar un mensaje informativo.
- **Renderizado:** `ChatMessageList` debe detectar URLs de mapas en `content` y mostrarlas como enlaces clicables con `target="_blank"` y `rel="noopener noreferrer"`.
- **Privacidad:** la geolocalización debe ser opt-in, mostrar el diálogo del navegador, permitir cancelar y no persistir coordenadas más allá del mensaje de texto.

Si en el futuro se requiere semántica más rica (por ejemplo, mostrar una miniatura de mapa o filtrar mensajes por tipo), evaluar la **Opción B** con una migración que agregue `messageType` y `latitude`/`longitude`/`locationUrl` a `order_messages`, documentando la retención de datos de ubicación.

## 6. Plan de implementación sugerido

1. **Modelo de datos**: para la Opción A/D no se requiere migración. Si se elige Opción B, generar migración con `npx drizzle-kit generate`, commitearla en `drizzle/` y actualizar `src/domain/types.ts`.
2. **Backend**:
   - Para Opción A: no es necesario cambiar `chatMessageContentSchema`; validar que el `content` enviado por el cliente sea una URL de mapa conocida (opcional, defensa en profundidad).
   - Para Opción D: en `chatService.sendOperatorMessage` o en una acción dedicada, leer `branch.location` vía `branchService.getBranchById(order.branchId)`, validar que sea una URL y enviarla como `content`.
3. **Frontend cliente**:
   - En `ChatComposer`, agregar un botón con icono de ubicación.
   - Llamar a `navigator.geolocation.getCurrentPosition` solo tras confirmación del usuario.
   - Mostrar una preview del enlace y permitir cancelar.
   - Enviar el mensaje a través de `useOrderChat.handleSend` usando `content`.
4. **Frontend operador**:
   - En el componente de chat del panel, agregar un botón "Enviar ubicación de la sucursal".
   - Habilitarlo solo para pedidos `pickup` con `branch.location` válido.
   - Llamar al endpoint de chat operador con el `content` de la URL.
5. **Renderizado**:
   - En `ChatMessageList`, detectar si `content` es una URL de mapas (Google Maps, OpenStreetMap, etc.) y renderizarla como un enlace destacado.
   - Opcional: agregar un icono de mapa y un texto como "Ver ubicación".
6. **Panel de pedidos**:
   - Considerar convertir la dirección del cliente en `PedidoInfo` en un enlace a mapas cuando `deliveryType === 'delivery'`.
7. **Configuración**:
   - No se requieren variables de entorno para Opción A/D.
   - Si se elige Opción C, agregar `NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL` y `NEXT_PUBLIC_MAPS_API_KEY`, leyendo siempre de `process.env`.
8. **Tests**:
   - Agregar tests unitarios en `chatService.test.ts` para validar envío de URL y mensajes con adjunto.
   - Agregar tests de componente en `order-chat.test.tsx` para renderizado de enlaces de mapa.
   - Agregar tests E2E en `pedido-chat.spec.ts` para compartir ubicación del cliente y de la sucursal.
9. **Verificaciones**: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm run knip`, `npm run test:e2e` en base descartable.

## 7. Riesgos

- **Privacidad**: si se opta por la Opción B, se persisten coordenadas del cliente. Hay que documentar la retención y justificar la necesidad.
- **Seguridad**: `branches.location` es texto libre; debe validarse como URL antes de enviarlo para evitar redirecciones maliciosas o esquemas inseguros.
- **Costos**: la Opción C requiere API key y puede generar costos por imágenes estáticas.
- **UX**: `navigator.geolocation` puede fallar, ser denegado o no estar disponible en navegadores antiguos. Hay que ofrecer fallback manual.
- **Regresiones**: agregar botones o payloads no debe romper el envío de texto e imágenes, ni alterar el rate limit, polling o paginación del chat.

## 8. Checklist de verificación

- [ ] Se confirma que hoy no se puede compartir ubicación por chat (salvo enlace manual).
- [ ] La solución elegida no hardcodea APIs, claves ni dominios.
- [ ] Se respeta el rate limit (`PUBLIC_CHAT_RATE_LIMIT_*`) y la autorización (`cancellationToken` / sesión operador).
- [ ] La geolocalización del cliente es opt-in y no se persisten coordenadas sin necesidad.
- [ ] `branch.location` se valida como URL antes de enviarse.
- [ ] Los mensajes de ubicación se ven en el chat del cliente y del operador.
- [ ] No se rompe el flujo de mensajes de texto e imágenes.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm run knip` y `npm run test:e2e` pasan.
- [ ] Si se agrega configuración o una decisión arquitectónica, se actualiza `AGENTS.md` y/o `.devin/informes/lecciones-aprendidas.md`.
