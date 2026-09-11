# Prompt: Auditar la capacidad de compartir ubicación por el chat de pedidos

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja y pedidos para una panchería.

Stack: Next.js 16.3.3, React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5 (beta.32), Zod 4.4.3.

Documentación de referencia:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/config/chat.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-attachment.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/useOrderChat.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/order-chat.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/[id]/chat/upload/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/pedidos/[id]/chat/upload/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-success-dialog.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-info.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/public-url.ts" />

## Estado actual relevante

- El chat soporta solo mensajes de texto e imágenes adjuntas. `order_messages` no distingue tipos de mensaje: tiene `content`, `attachmentUrl`, `attachmentKey`, `attachmentMimeType`, `attachmentSize` y `attachmentName`, pero no campos de ubicación ni un `messageType` o `locationUrl`.
- `chatMessageContentSchema` en <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" /> solo valida `content` como `string` obligatorio.
- `ChatComposer` en <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" /> expone un input de archivo para imágenes y un `<Textarea>` para texto; no tiene botón ni llamada a `navigator.geolocation`.
- `ChatMessageList` y `ChatAttachment` en <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-attachment.tsx" /> renderizan texto e imagen; no hay representación especial para enlaces de mapas ni coordenadas.
- Un pedido tiene `deliveryType` (`delivery` | `pickup`) y `address` como texto libre; no hay latitud/longitud en `orders` ni en `order_messages`.
- La sucursal almacena `location` como texto libre en `branches.location`; <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" /> lo etiqueta como "URL del mapa o coordenadas". Ese mismo enlace se muestra en <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> y <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-success-dialog.tsx" /> como "Ver en mapa".
- `PedidoInfo` en <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-info.tsx" /> muestra la dirección del cliente como texto plano, sin enlace ni mapa.
- No existen variables de entorno, helpers ni librerías de geolocalización o mapas.
- `sendClientMessage` y `sendOperatorMessage` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" /> aceptan `content` y `attachment`; no aceptan un objeto de ubicación.

> **Resultado esperado de la auditoría:** hoy no es posible compartir ubicación de forma estructurada por el chat. El único mecanismo disponible es que el cliente u operador copien y peguen manualmente un enlace de mapas en el campo de texto.

## Objetivo

Auditar el proyecto y determinar, concretamente, si **actualmente** se puede compartir la ubicación actual por medio del chat integrado. Si no se puede, identificar las brechas técnicas y de modelo de datos, y proponer la solución mínima viable para soportar:

1. Que un **cliente** con un pedido `delivery` pueda compartir su ubicación de envío desde el chat público.
2. Que el **operador** en el panel pueda ver esa ubicación o acceder a ella (por ejemplo, abriendo un enlace de maps).
3. Que el **operador** pueda compartir la ubicación de la sucursal en el chat cuando el cliente hizo un pedido `pickup` y la necesita para retirar.
4. Viceversa: si el cliente pide la ubicación del local, el operador debe poder enviarla sin salir del chat.

## Reglas de negocio

1. No hardcodear URLs de APIs, claves de mapas, parámetros sensibles ni dominios. Todos los valores configurables deben provenir de variables de entorno o configuraciones dinámicas (`src/config/*`, `.env.local`, `process.env`).
2. Mantener el rate limiting y la autorización existentes del chat (`cancellationToken` para clientes, sesión del operador, `createRateLimiter` para escrituras públicas).
3. No romper el flujo actual de mensajes de texto e imágenes.
4. Si se requiere alguna clave de API (Google Maps, Mapbox, OpenStreetMap, etc.), debe leerse de variables de entorno; nunca commitearse.
5. Cualquier cambio en el esquema de base de datos debe acompañarse de la migración generada con `npx drizzle-kit generate` y commitearse en `drizzle/`.
6. Todo el código, comentarios y documentación relacionados deben estar en español.

## Consideraciones de seguridad y privacidad

- La geolocalización del cliente debe ser **opt-in**, mostrar el aviso del navegador, permitir cancelar y no almacenar coordenadas si no es estrictamente necesario.
- `navigator.geolocation` solo funciona en contextos seguros (HTTPS o `localhost`); documentar el comportamiento si no se cumple.
- No persistir coordenadas en `order_messages` cuando el objetivo sea solo compartir una ubicación puntual; preferir enviar un enlace generado en el cliente.
- Si se persisten coordenadas (Opción B), documentar por qué es estrictamente necesario, agregar retención mínima y no exponer datos de ubicación a terceros.
- Validar que `branch.location` sea una URL antes de enviarla como enlace; evitar esquemas inseguros o valores arbitrarios.
- Mantener el rate limit del chat para evitar spam de ubicación.

## Lecciones aplicables

- El chat propio es el único canal de comunicación con el cliente; la integración con WhatsApp fue eliminada. No reintroducir canales externos. <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- Los endpoints públicos de escritura deben tener rate limit (`createRateLimiter` con scope propio).
- El fallback a `http://localhost:3000` en `getPublicBaseUrl()` no debe activarse en producción; si se generan URLs de mapas en el servidor, usar `getPublicBaseUrl()` o similar y documentar `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL`.
- Cualquier workaround temporal requiere fecha de revisión y un test que falle cuando ya no sea necesario.
- El polling del chat usa backoff exponencial y cursores `before`/`after`; respetar esos patrones al agregar nuevos mensajes.

## Análisis requerido

### 1. Capacidad actual

Revisar y responder concretamente:
- ¿El modelo de datos del chat soporta algún tipo de mensaje de ubicación?
- ¿Los endpoints de chat aceptan latitud/longitud o algún metadato de ubicación?
- ¿El compositor del chat tiene algún botón o acceso a `navigator.geolocation`?
- ¿El listado de mensajes renderiza mapas, enlaces de ubicación o coordenadas?
- ¿La sucursal almacena latitud/longitud de forma estructurada o solo un enlace/libre?
- ¿El panel del operador muestra la dirección del cliente de forma que se pueda abrir en un mapa?

Archivos clave a inspeccionar:
- <ref_file file="C:/developer/paginas/pancheria/src/db/schema.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/domain/types.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/zod-schemas.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-composer.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-message-list.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/chat/chat-attachment.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedidos/pedido-info.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" />

### 2. Brechas identificadas

Listar, por orden de criticidad, qué falta para que el cliente y el operador puedan compartir ubicaciones:
- Campos de datos (tablas y tipos).
- Cambios en endpoints (`route.ts` de chat).
- Cambios en componentes (botón de compartir ubicación, render de mensaje de ubicación).
- Cambios en servicios (`chatService.ts`, `branchService.ts` si aplica).
- Permisos del navegador y experiencia de usuario.
- Configuración/variables de entorno necesarias.

### 3. Alternativas de implementación

Evaluar al menos estas opciones y recomendar la más adecuada para el proyecto, justificando por qué:

**Opción A — Enlace generado con coordenadas (cliente delivery)**
- Usar `navigator.geolocation.getCurrentPosition` en el cliente.
- Enviar un mensaje de texto con un enlace a Google Maps / OpenStreetMap que contenga `lat,lng`.
- Impacto: sin cambios en el esquema; reutiliza `chatMessageContentSchema` y `content`; `ChatComposer` agrega un botón y `ChatMessageList` detecta/renderiza el enlace.
- Ventajas: sin librerías nuevas, sin costos, rápido de implementar, no almacena coordenadas.
- Desventajas: requiere permiso del usuario; el receptor abre el enlace en otra app; menos semántica (se confunde con texto plano).

**Opción B — Mensaje de ubicación estructurado**
- Agregar columnas `latitude`, `longitude` y opcionalmente `locationUrl` (y/o un `messageType` con valores `text`, `image`, `location`) a `order_messages`.
- Renderizar el mensaje como una burbuja especial con enlace al mapa.
- Impacto: migración de base de datos, cambios en `OrderMessage`, `chatService.sendClientMessage`/`sendOperatorMessage`, Zod schemas, `ChatComposer`, `ChatMessageList` y tests.
- Ventajas: semántica clara, extensible a futuras mejoras (mapa estático, mapa embebido).
- Desventajas: requiere migración de base de datos y cambios en el schema; eleva la retención de coordenadas; mayor mantenimiento.

**Opción C — Imagen estática del mapa**
- Generar una imagen con Google Static Maps, Mapbox Static Tiles u OpenStreetMap.
- Adjuntarla como imagen del chat (`attachmentUrl`, `attachmentMimeType`).
- Impacto: requiere proveedor, API key y lógica de generación en `chatService` o en un helper; se reutiliza `ChatAttachment`.
- Ventajas: se ve directamente en el historial.
- Desventajas: puede requerir API key, costo, no es interactiva y complica almacenamiento/caché.

**Opción D — Reutilizar `branch.location` para retiro**
- El operador envía un mensaje con el enlace guardado en `branches.location`.
- Impacto: backend lee `branch.location`, lo valida como URL y lo envía a través de `sendOperatorMessage`; frontend operador agrega un botón; no requiere geolocalización del cliente.
- Ventajas: ya existe el campo; no requiere geolocalización ni migración.
- Desventajas: es manual si no se automatiza; `branch.location` es texto libre y debe validarse antes de enviarlo.

### 4. Recomendación final

Definir qué opción (o combinación) implementar y por qué, considerando:
- Complejidad.
- Costos (APIs de terceros).
- Privacidad.
- Mantenimiento a largo plazo.
- Consistencia con el stack actual.

> **Orientación esperada:** la solución mínima viable recomendada suele ser una combinación de la **Opción A** para que el cliente comparta su ubicación en envíos a domicilio y la **Opción D** para que el operador comparta la ubicación de la sucursal en retiros. Si se requiere semántica más rica o funcionalidades futuras, puede plantearse la **Opción B** como evolutivo, consciente de la migración y de la retención de datos.

## Plan de implementación sugerido (si la auditoría concluye que no es posible hoy)

1. **Modelo de datos**:
   - Decidir si agregar campos a `order_messages` (Opción B) o reutilizar `content` + metadato de adjunto (Opción A/D).
   - Si se agregan campos, generar migración con `npx drizzle-kit generate`, commitearla en `drizzle/` y actualizar `src/domain/types.ts`.
2. **Backend**:
   - Extender `SendMessageInput` y/o `chatMessageContentSchema` para aceptar ubicación o URL.
   - Validar coordenadas (rango lat/lng) o URL de mapas.
   - Actualizar `sendClientMessage` y `sendOperatorMessage` en <ref_file file="C:/developer/paginas/pancheria/src/application/services/chatService.ts" />.
3. **Frontend cliente**:
   - Agregar botón en `ChatComposer` para obtener ubicación vía `navigator.geolocation`.
   - Mostrar preview de coordenadas/enlace y confirmar antes de enviar.
   - Enviar el enlace como `content` (Opción A) o como payload estructurado (Opción B).
4. **Frontend operador**:
   - Agregar botón para compartir la ubicación de la sucursal (`branch.location`) validada como URL.
   - Permitir compartirla solo si el pedido es `pickup` y la sucursal tiene `location` configurado.
5. **Renderizado**:
   - En `ChatMessageList`/`ChatAttachment`, mostrar mensajes de ubicación como enlace clicable a Google Maps / OpenStreetMap, respetando el tema visual.
   - Usar `target="_blank"` y `rel="noopener noreferrer"`.
6. **Panel de pedidos**:
   - Considerar mostrar la ubicación compartida del cliente en `PedidoInfo` cuando exista, para que el repartidor/operador no tenga que entrar al chat.
7. **Configuración**:
   - Agregar variables de entorno opcionales para el proveedor de mapas y URLs base (por ejemplo, `NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`, `NEXT_PUBLIC_MAPS_API_KEY`) **solo si se elige la Opción C o un proveedor de mapas estáticos**.
   - Documentar que cualquier clave se lee de `process.env` y nunca se hardcodea.
8. **Tests**:
   - Actualizar o crear tests unitarios (`chatService.test.ts`, `order-chat.test.tsx`).
   - Crear tests E2E (`pedido-chat.spec.ts`) para compartir ubicación y abrir enlaces.
   - Verificar build, lint, tipos y `knip`.

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm run lint` | Estilo y calidad |
| `npm test` | Tests unitarios |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto |
| `npm run test:e2e` | Tests E2E en base de prueba descartable |
| `npx drizzle-kit generate` | Generar migración si cambia el esquema |
| `npx drizzle-kit migrate` | Aplicar migración en desarrollo/E2E |

## Criterios de aceptación

- [ ] Se determina con claridad si hoy se puede compartir ubicación por chat (respuesta esperada: **no**, salvo por enlace manual).
- [ ] Se listan todas las brechas técnicas, de modelo y de UX con referencias a archivos de código.
- [ ] Se recomienda una solución mínima viable que no hardcodee APIs ni claves, respete la privacidad y mantenga rate limit y autorización.
- [ ] Si se implementa, los mensajes de ubicación se ven tanto en el chat del cliente como en el del operador.
- [ ] El flujo de `delivery` permite al cliente compartir su ubicación de envío.
- [ ] El flujo de `pickup` permite al operador compartir la ubicación de la sucursal.
- [ ] No se rompe el flujo de mensajes de texto e imágenes.
- [ ] Todos los tests, build, lint, typecheck y `knip` pasan.
- [ ] Se actualiza `AGENTS.md` y/o `.devin/informes/lecciones-aprendidas.md` si se introduce alguna decisión arquitectónica, workaround o configuración nueva.

## Salida esperada del auditor

Producir un informe breve con las siguientes secciones:

1. **Resumen ejecutivo**: ¿Se puede compartir ubicación por chat hoy? Respuesta de una línea.
2. **Evidencia de capacidad actual**: qué soporta y qué no, citando archivos y componentes.
3. **Brechas técnicas**: modelo, backend, frontend, UX, permisos.
4. **Alternativas evaluadas**: tabla comparativa con ventajas, desventajas e impacto.
5. **Recomendación final**: opción elegida y justificación.
6. **Plan de implementación**: pasos concretos, archivos a tocar y migraciones necesarias.
7. **Riesgos**: privacidad, costos, mantenimiento, dependencias.
8. **Checklist de verificación**: comandos a ejecutar y criterios de aceptación.

Si la recomendación incluye implementación, el informe debe poder convertirse en un plan de trabajo con `todo_write` y tickets de seguimiento.
