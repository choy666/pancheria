# Prompt: datos de sucursal al inicio de `/pedido`, mapa embebido y select de redes sociales

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui (base-ui), Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright, lucide-react.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

Código relevante:

- Encabezado del catálogo público (selector de sucursal + chip de estado): <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" />
- `BranchInfoCard` (tarjeta completa de sucursal, hoy solo en el diálogo de checkout) y cliente de `/pedido`: <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- Chip de estado abierto/cerrado del encabezado: <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/branch-status-chip.tsx" />
- Hook con `BranchStatus`, `fetchBranchStatus` y `handleBranchChange`: <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/usePedidoClient.ts" />
- API pública que ya expone la sucursal completa: <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/sucursal/estado/route.ts" />
- Formulario admin de sucursal (ubicación, teléfonos, redes, horarios): <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" />
- Helpers de mapas (`tryBuildLocationUrl`, `isValidLocationUrl`, proveedor): <ref_file file="C:/developer/paginas/pancheria/src/lib/maps.ts" />
- Config del proveedor de mapas (`NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`): <ref_file file="C:/developer/paginas/pancheria/src/config/maps.ts" />
- Helpers de sucursal (`formatOpeningHours`, `getSocialLinkHref`, `SOCIAL_NETWORK_OPTIONS`, normalización): <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-helpers.ts" />
- CSP por request con nonce (`frame-src 'self'` hoy): <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" />
- Select del sistema de diseño (base-ui): <ref_file file="C:/developer/paginas/pancheria/src/components/ui/select.tsx" />
- Diálogo de pedido creado (CTA principal "Ir al chat del pedido"): <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-success-dialog.tsx" />
- Tests E2E del formulario de sucursal y contactos: <ref_file file="C:/developer/paginas/pancheria/tests/e2e/sucursal-contactos-y-turnos.spec.ts" />
- Tests unitarios del cliente de pedido y de mapas: <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.test.tsx" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/maps.test.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.test.ts" />

## Estado actual relevante

- **El cliente no ve los datos de la sucursal al inicio de `/pedido`.** En el encabezado solo hay título, pasos del flujo, selector de sucursal y `BranchStatusChip` (abierto/cerrado). La tarjeta completa `BranchInfoCard` (nombre, horario de hoy, todos los horarios, dirección, teléfonos, redes sociales y "Ver en mapa") se renderiza recién dentro del diálogo de checkout ("Paso 3 de 3"), cuando el pedido ya está armado.
- **El backend ya expone todo lo necesario:** `GET /api/public/sucursal/estado` devuelve `branch` con `openingHours`, `address`, `phones`, `socialLinks` y `location`, y `fetchBranchStatus` corre al montar `/pedido` y en cada polling (`usePedidoClient.ts`). `activeBranch` del SSR también trae esos campos (`catalogService.listPublicCatalogWithAvailability` devuelve la sucursal completa). No hace falta tocar APIs ni servicios.
- **`branch.location` es una URL o coordenadas normalizadas.** `normalizeLocation` (`branchService.ts`) guarda coordenadas `lat,lng` como URL del proveedor (`NEXT_PUBLIC_MAPS_PROVIDER`, por defecto `openstreetmap`) o una URL http(s) tal cual. En la UI pública solo se muestra como enlace externo "Ver en mapa"; **no existe ningún `<iframe>` en el código**.
- **La CSP bloquea iframes externos hoy:** `frame-src 'self'` en `getCspHeader` (`src/lib/csp-helpers.ts`). Para embeber el mapa hay que agregar el origen del proveedor a `frame-src`, resuelto por configuración (no hardcodeado). Ojo: `X-Frame-Options: SAMEORIGIN` de `next.config.ts` es para que *otros* no enmarquen nuestra app, no afecta este caso.
- **El `<select>` nativo de redes sociales es ilegible en el tema oscuro.** `branch-form.tsx` usa `<select>`/`<option>` crudos (líneas ~329-344): el popup de opciones hereda el estilo del SO/navegador y se ve con fondo claro y texto casi invisible (ver captura reportada). El proyecto ya usa el `Select` de base-ui (`src/components/ui/select.tsx`) para el selector de sucursal del catálogo; `Select.Root` acepta `name` y envía el valor en el `FormData` mediante un input oculto, por lo que `socialLinks[i][network]` sigue llegando a `parseContactsForm` sin cambios.
- **El test E2E del formulario usa la API de select nativo:** `sucursal-contactos-y-turnos.spec.ts` hace `selectOption('instagram')` y `toHaveValue('instagram')` sobre `branch-social-network-0`. Al migrar a base-ui hay que actualizarlo al patrón del selector de sucursal (click en el trigger + `getByRole('option', { name: ... })`, como en `pedido-sucursal-y-stock.spec.ts` línea ~119-120).
- **El canal propio es el chat del pedido.** La integración con WhatsApp fue eliminada (ver `guia-funcionamiento-pancheria.md` §14): el pedido se coordina por `/pedido/[id]/chat` y `PedidoSuccessDialog` ya tiene "Ir al chat del pedido" como acción principal. Hoy las redes (incluido `whatsapp`, que se convierte a `wa.me` vía `getSocialLinkHref`) se muestran como links de texto; hay que cuidar que en la nueva tarjeta no compitan con el flujo de pedido propio.

## Objetivo

1. Que el cliente vea **al inicio de `/pedido`** —antes de armar el pedido— los datos de la sucursal seleccionada: estado abierto/cerrado, horario de hoy y todos los horarios, dirección, teléfonos (incluido el etiquetado para pedidos), redes sociales y ubicación.
2. Que la ubicación se muestre como **mapa embebido (iframe)** cuando el valor cargado lo permita, con fallback al enlace externo actual, y que el formulario de sucursal guíe al admin para cargar una ubicación aprovechable.
3. Reemplazar el `<select>` nativo de redes sociales por el `Select` del sistema de diseño para que las opciones sean legibles y consistentes.
4. Reforzar con microcopy e jerarquía visual que el pedido se hace por la plataforma (con chat incluido), sin empujar al cliente hacia WhatsApp u otros canales externos.

## Alcance

Aplicar cambios en:

- `src/components/pedido/pedido-catalog-section.tsx` (tarjeta de sucursal en el encabezado).
- `src/components/pedido/pedido-client.tsx` (extraer/reutilizar `BranchInfoCard`).
- `src/components/pedido/` (nuevo componente, p. ej. `branch-info-card.tsx` y/o `branch-map.tsx`).
- `src/lib/maps.ts` y `src/config/maps.ts` (URL embebible y orígenes permitidos).
- `src/lib/csp-helpers.ts` (`frame-src`).
- `src/components/sucursales/branch-form.tsx` (select de redes + ayuda de ubicación).
- Tests unitarios y E2E mencionados.

No modificar:

- Esquema de base de datos ni migraciones (`branches.location`, `phones`, `social_links` ya existen).
- APIs públicas ni servicios (`/api/public/sucursal/estado` ya devuelve todo).
- Lógica de negocio de pedidos, reservas, disponibilidad ni rate limit.
- `data-testid` existentes salvo los ajustes puntuales del select de redes (ver §4).

## Criterios de aceptación

- [ ] Al entrar a `/pedido`, el cliente ve los datos de la sucursal activa sin abrir el checkout: estado, horario de hoy, horarios completos (colapsables), dirección, teléfonos con etiqueta, redes sociales y ubicación.
- [ ] Si `branch.location` es embebible, se muestra un `<iframe>` con el mapa (diferido/colapsable); si no, se mantiene el enlace "Ver en mapa". Nunca se rompe la página por una ubicación no embebible.
- [ ] La CSP permite el origen del iframe solo para el/los proveedores configurados (`NEXT_PUBLIC_MAPS_PROVIDER` / `NEXT_PUBLIC_MAPS_BASE_URL`), sin dominios hardcodeados sueltos.
- [ ] El select de redes sociales usa `src/components/ui/select.tsx`, las opciones son legibles en el tema oscuro y el `FormData` sigue enviando `socialLinks[i][network]` sin cambios en `parseContactsForm` ni en las server actions.
- [ ] El formulario de sucursal incluye texto de ayuda que recomienda formatos de ubicación embebibles (coordenadas `lat,lng` o enlace "Insertar mapa" de Google) y advierte que los short links (`maps.app.goo.gl`, `goo.gl/maps`) se muestran solo como enlace.
- [ ] En la tarjeta inicial hay un mensaje que invita a pedir por la plataforma y usar el chat del pedido; los enlaces externos (redes, WhatsApp) quedan como información secundaria, nunca como botones/CTA que compitan con el catálogo.
- [ ] Se preservan `data-testid` existentes (`branch-phone`, `branch-social-links`, `branch-status-chip`, `branch-location`, `branch-social-network-N`, `branch-social-url-N`, `branch-add-social`, `branch-remove-social-N`) y se agregan los nuevos (`branch-info-card`, `branch-map-frame`/`branch-map-link`).
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` pasan; los specs E2E afectados se actualizan y pasan en base descartable.

## Reglas de negocio

1. **Una sola fuente de verdad de sucursal:** la tarjeta consume `activeBranch` (SSR) y `branchStatus.branch` (API) como ya hace `BranchInfoCard`; no crear endpoints ni duplicar fetchs. El polling existente (`fetchBranchStatus` + `useVisibilityPolling`) ya mantiene el estado al día.
2. **Iframe progresivo y perezoso:** el mapa se renderiza solo si existe una URL embebible derivada de `branch.location`; va dentro de un `<details>`/sección colapsable o con `loading="lazy"` para no cargar el proveedor sin interacción (performance y privacidad del cliente). Siempre con `title` descriptivo y el enlace externo como alternativa accesible.
3. **Derivación de URL embebible:** nueva función (p. ej. `buildMapEmbedUrl(location: string): string | null`) en `src/lib/maps.ts` que:
   - Acepte coordenadas `lat,lng` (reutilizando `tryParseCoordinates`) y genere la URL de embed del proveedor configurado: OSM → `export/embed.html?bbox=…&layer=mapnik&marker=lat,lng`; Google → `maps.google.com/maps?q=lat,lng&z=16&output=embed`.
   - Detecte URLs de OSM con `mlat`/`mlon` (formato que guarda `tryBuildLocationUrl`) y las traduzca al embed.
   - Detecte URLs ya embebibles (`/maps/embed`, `export/embed.html`, `output=embed`) y las devuelva tal cual, siempre validando http(s) y origen permitido.
   - Devuelva `null` para short links (`maps.app.goo.gl`, `goo.gl/maps`), Waze (sin embed público) y cualquier origen no permitido → fallback al enlace.
4. **Orígenes de `frame-src` por configuración:** nuevo getter en `src/config/` (p. ej. `getMapsFrameOrigins()` en `src/config/maps.ts` o `storage-origins.ts` según el patrón) que devuelva los orígenes permitidos según `NEXT_PUBLIC_MAPS_PROVIDER` y `NEXT_PUBLIC_MAPS_BASE_URL` (derivar el origen con `new URL()`); `getCspHeader` los concatena a `frame-src`. `buildMapEmbedUrl` solo devuelve URLs cuyo origen esté en esa lista, para que CSP y renderer nunca se desincronicen.
5. **Canal propio primero:** la tarjeta inicial incluye microcopy que invita a pedir por la plataforma (p. ej. "Hacé tu pedido acá y coordiná todo por el chat del pedido, sin salir de la página"). Los enlaces externos (redes sociales, WhatsApp) se muestran como texto secundario con link chico —nunca botones, nunca por encima del catálogo—. El contacto de WhatsApp puede mostrarse como número informativo; el enlace `wa.me` queda como máximo en contextos post-pedido, donde "Ir al chat del pedido" es la acción principal.
6. **Select del sistema de diseño:** reemplazar el `<select>` nativo por `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` de `@/components/ui/select`, usando `items` de `SOCIAL_NETWORK_OPTIONS` o `SelectItem` por opción. Mantener `name={`socialLinks[${index}][network]`}` en `Select.Root` (base-ui envía el valor con un input oculto), `value` controlado con `link.network` y `onValueChange` → `updateSocialLink`. El `data-testid={`branch-social-network-${index}`}` pasa al `SelectTrigger`; el `aria-label` se conserva.
7. **Jerarquía visual coherente:** la tarjeta no debe competir con el catálogo: información compacta, secciones extensas (todos los horarios, mapa) colapsadas por defecto, todo con tokens del tema (`border-white/8`, `text-muted-foreground`, `primary`) e iconos de `lucide-react` (`MapPin`, `Phone`, `Clock`, `MessageCircle`, etc.). Si `BranchInfoCard` se reutiliza en checkout y encabezado, parametrizar lo que difiere (p. ej. prop `variant`/`showStatusBanner`) en vez de duplicar el componente.
8. **Idioma español** en textos de UI, comentarios y documentación. Sin valores hardcodeados de configuración: dominios de mapas, orígenes y textos salen de `src/config/` o constantes del componente.

## Implementación detallada

### 1. Tarjeta de sucursal al inicio de `/pedido`

- Extraer `BranchInfoCard` de <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" /> (líneas ~34-157) a `src/components/pedido/branch-info-card.tsx`, exportada y parametrizable:
  - Prop `variant: 'header' | 'checkout'` (o equivalente) para ajustar densidad: en `header` el estado abierto/cerrado ya lo muestra `BranchStatusChip`, así que el banner verde/ámbar puede omitirse o reducirse; en `checkout` se mantiene como hoy.
  - Agregar `data-testid="branch-info-card"` al contenedor.
  - Orden sugerido del contenido: mensaje de invitación a pedir por la plataforma → horario de hoy + "Ver todos los horarios" (ya existe como `<details>`) → dirección → teléfonos (`label: number`, conservando `data-testid="branch-phone"` en el primero) → ubicación (mapa o enlace) → redes sociales como texto secundario (`data-testid="branch-social-links"`).
- Renderizarla en <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-catalog-section.tsx" /> dentro de la card del encabezado (debajo del `flex` título/selector), pasando `branchStatus` y `activeBranch` que ya llegan como props. En mobile debe colapsar bien: evaluar envolver secciones pesadas en `<details>` para no empujar el catálogo hacia abajo.
- En `pedido-client.tsx`, reemplazar la definición local por el import del componente extraído y usar la variante `checkout` en el diálogo (misma info, sin duplicar markup).
- Microcopy de invitación (regla 5): una línea visible en la tarjeta del encabezado, p. ej. "Pedí por acá: el local confirma tu pedido y coordinás todo por el chat, sin salir de la página." No agregar botones externos.

### 2. Mapa embebido con fallback

- En <ref_file file="C:/developer/paginas/pancheria/src/lib/maps.ts" />: exportar `buildMapEmbedUrl(location: string): string | null` con la regla 3 (coordenadas → embed del proveedor; URL OSM con `mlat`/`mlon` → embed; URL ya embebible u origen permitido → tal cual; resto → `null`). Puede requerir exportar o reutilizar `tryParseCoordinates` (hoy es privada).
- En <ref_file file="C:/developer/paginas/pancheria/src/config/maps.ts" /> (o `storage-origins.ts`): nuevo getter `getMapsFrameOrigins(): string[]` — orígenes https del proveedor (`openstreetmap.org`, `maps.google.com`/`www.google.com` según corresponda al provider, Waze → `[]`) más el origen de `NEXT_PUBLIC_MAPS_BASE_URL` si está definido. Sin dominios sueltos en el código del CSP.
- En <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" />: `frame-src 'self' ...getMapsFrameOrigins()` y actualizar `csp-helpers.test.ts`.
- Nuevo `src/components/pedido/branch-map.tsx` (cliente): recibe `location` y `branchName`; resuelve `buildMapEmbedUrl`; si hay URL, renderiza `<details>` con summary "Ver mapa" (icono `MapPin`) conteniendo `<iframe src={embedUrl} title={`Mapa de ${branchName}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="aspect-video w-full rounded-md border-0" data-testid="branch-map-frame" />` más un enlace "Abrir en el mapa" (`data-testid="branch-map-link"`); si no hay URL embebible, solo el enlace externo actual. Evaluar `sandbox` en el iframe (p. ej. `allow-scripts allow-same-origin allow-popups`) documentando la elección — OSM/Google embeds requieren scripts.
- Integrar `BranchMap` dentro de `BranchInfoCard` donde hoy está el `<a>` "Ver en mapa" (mantener ese enlace como fallback dentro del componente nuevo).

### 3. Consejos de carga en `branch-form.tsx`

- Bajo el input `branch-location` (líneas ~308-318) agregar texto de ayuda (`text-sm text-muted-foreground`) que recomiende, en orden:
  1. **Coordenadas** `lat,lng` (ej. `-32.9468, -60.6393`) — el formato más portable; el servidor las normaliza al proveedor configurado y el mapa se embebe en `/pedido`.
  2. **Enlace "Insertar mapa"** de Google Maps (Compartir → Insertar un mapa → copiar solo la URL del `src`) o el enlace completo de `openstreetmap.org` — se embebe directo.
  3. Advertir que los **short links** (`maps.app.goo.gl/...`, como el de la captura reportada) y otros enlaces genéricos se muestran como "Ver en mapa" sin mapa embebido.
- Explicar brevemente dónde obtener las coordenadas (clic derecho en Google Maps sobre el punto → copiar coordenadas). Mantener `data-testid="branch-location"` y el placeholder (ajustarlo a "Ej: -32.9468, -60.6393 o URL del mapa").
- Documentar la misma guía en `AGENTS.md`/`guia-funcionamiento-pancheria.md` §2.1 si el formato recomendado cambia el comportamiento visible (regla de documentación vigente del proyecto).

### 4. Select de redes sociales con el sistema de diseño

- En <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" /> reemplazar el `<select>`/`<option>` nativo (líneas ~329-344) por:
  - `<Select value={link.network} name={`socialLinks[${index}][network]`} onValueChange={(v) => updateSocialLink(link._id, 'network', v)}>` con `<SelectTrigger data-testid={`branch-social-network-${index}`} aria-label={`Red social ${index + 1}`} className="w-full sm:w-[160px]">` + `<SelectValue />`, y `<SelectContent>` con `<SelectItem>` por cada `SOCIAL_NETWORK_OPTIONS`.
  - Verificar que `parseContactsForm` siga recibiendo `socialLinks[i][network]` (el input oculto de base-ui) — no tocar `actions.ts` ni `branch-helpers.ts`.
- Actualizar `tests/e2e/sucursal-contactos-y-turnos.spec.ts`:
  - `page.getByTestId('branch-social-network-0').selectOption('instagram')` → click en el trigger + `page.getByRole('option', { name: 'Instagram' }).click()`.
  - `toHaveValue('instagram')` (repoblación al editar) → assert sobre el texto del trigger (`toHaveText('Instagram')` o `toContainText`).
- Alternativa si se prefiere mínimo cambio (documentar la decisión): mantener el `<select>` nativo y estilizar las opciones (`bg-popover text-popover-foreground` en `option`), sabiendo que el popup nativo es inconsistente entre navegadores/SO. Recomendado: el `Select` de base-ui por consistencia con el resto del proyecto.

### 5. Prioridad del canal propio

- En la tarjeta del encabezado: el mensaje de invitación a pedir por la plataforma va primero y las redes sociales al final, como texto secundario (regla 5). Si se lista `whatsapp`, mostrarlo como "WhatsApp: {número}" informativo; el enlace `wa.me` es opcional y nunca con estilo de botón.
- No agregar CTAs externos al encabezado ni al catálogo. `PedidoSuccessDialog` ya prioriza "Ir al chat del pedido" — mantener esa jerarquía; si se toca el diálogo, que las redes queden por debajo del CTA.

### 6. Tests

- **Unitarios:**
  - `src/lib/maps.test.ts`: casos de `buildMapEmbedUrl` — coordenadas → embed del proveedor, URL OSM `mlat`/`mlon` → embed, URL ya embebible → tal cual, short link/`wa.me`/URL arbitraria → `null`, respeto a `NEXT_PUBLIC_MAPS_BASE_URL`.
  - `src/lib/csp-helpers.test.ts`: `frame-src` incluye el/los orígenes del proveedor configurado.
  - `pedido-client.test.tsx`: la tarjeta (`branch-info-card`) se ve en el encabezado al montar `/pedido` con teléfonos, redes y ubicación; el mapa/iframe aparece solo con ubicación embebible; fallback a enlace en caso contrario.
- **E2E:**
  - `sucursal-contactos-y-turnos.spec.ts`: migrar las interacciones del select a base-ui (ver §4) y agregar, si no queda cubierto, assert de `branch-info-card` visible en `/pedido` antes del checkout con el teléfono y la red creados.
  - Evaluar un assert del iframe (`branch-map-frame`) cuando `location` son coordenadas, y del enlace cuando es un short link — puede cubrirse con `page.route` o creando la sucursal con cada formato vía UI/seed.
- **knip:** si `buildMapEmbedUrl`/`getMapsFrameOrigins` quedan exportados sin uso, knip falla — asegurar que el componente y el CSP los consuman.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, secretos ni dominios: los orígenes de mapas se derivan de `NEXT_PUBLIC_MAPS_PROVIDER`/`NEXT_PUBLIC_MAPS_BASE_URL` mediante un getter de `src/config/`, como hacen `getStorageImageOrigins`/`getStorageRemoteOrigins`.
- La CSP se endurece por diseño: agregar a `frame-src` **solo** los orígenes resueltos por configuración; no usar `*` ni `https:` comodín. `buildMapEmbedUrl` valida protocolo http(s) y origen permitido antes de devolver una URL.
- El iframe carga un tercero (OSM/Google): por eso va diferido (`loading="lazy"` y/o `<details>` cerrado por defecto), con `referrerPolicy` acotado y `title` para accesibilidad. No enviar datos del cliente al proveedor.
- Si se introduce una variable nueva (p. ej. `NEXT_PUBLIC_MAPS_EMBED_BASE_URL`), documentarla en `AGENTS.md`, `README.md`, `.env.example` y `.devin/environment.yaml` (regla de lecciones aprendidas §6).
- Ejecutar tests E2E solo en una base de datos descartable (`test`, `e2e`, `testing`, `qa` o `staging`), siguiendo `AGENTS.md`. `sucursal-contactos-y-turnos.spec.ts` crea sucursales reales: corre en la base E2E.
- No commitear `.env.local`, `.env.e2e` ni archivos de entorno.

## Verificaciones

Ejecutar en orden:

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios (maps, csp-helpers, pedido-client) |
| 4 | `npm run build` | Build de producción |
| 5 | `npm run knip` | Detección de código muerto |
| 6 | `npx playwright test tests/e2e/sucursal-contactos-y-turnos.spec.ts tests/e2e/pedido-sucursal-y-stock.spec.ts` | E2E afectados (base descartable, `.env.e2e`) |
| 7 | `npm run test:e2e` | Suite completa E2E si el alcance lo justifica |

Verificación manual recomendada: crear/editar una sucursal en `/sucursales` con (a) coordenadas, (b) enlace embed de Google y (c) short link `maps.app.goo.gl`; abrir `/pedido` con cada una y comprobar: datos visibles al inicio, iframe solo en (a)/(b), enlace "Ver en mapa" en (c), select de redes legible al editar.

Si alguna verificación falla, corregir antes de continuar. Documentar decisiones no triviales en `.devin/informes/lecciones-aprendidas.md` si aplica, y archivar este prompt en `.devin/prompts/archivados/` al completarse.
