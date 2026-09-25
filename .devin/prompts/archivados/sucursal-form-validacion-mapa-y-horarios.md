# Prompt: validación en vivo, preview de mapa y copiado de horarios en el formulario de sucursal

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui (base-ui), Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright, lucide-react.

Documentación de referencia obligatoria:

- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/archivados/datos-sucursal-y-mapa-en-pedido.md" /> — prompt resuelto donde se implementó el mapa embebido en `/pedido` (`buildMapEmbedUrl`, `getMapsFrameOrigins`, `BranchMap`); este trabajo se apoya en esa base.

Código relevante:

- Formulario admin de sucursal (alta/edición): <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" />
- Server actions de sucursales (`createBranch`, `updateBranchAction`, `BranchState`): <ref_file file="C:/developer/paginas/pancheria/src/app/(panel)/sucursales/actions.ts" />
- Validación de negocio (`normalizeLocation`, `validateOpeningHours`, `normalizeBranchPhones`, `normalizeSocialLinks`): <ref_file file="C:/developer/paginas/pancheria/src/application/services/branchService.ts" /> y <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-helpers.ts" />
- Helpers de mapas (`tryBuildLocationUrl`, `isValidLocationUrl`, `buildMapEmbedUrl`, `tryParseCoordinates`): <ref_file file="C:/developer/paginas/pancheria/src/lib/maps.ts" />
- Config del proveedor de mapas (`NEXT_PUBLIC_MAPS_PROVIDER`, `NEXT_PUBLIC_MAPS_BASE_URL`, `getMapsFrameOrigins`): <ref_file file="C:/developer/paginas/pancheria/src/config/maps.ts" />
- CSP con `frame-src 'self' + getMapsFrameOrigins()`: <ref_file file="C:/developer/paginas/pancheria/src/lib/csp-helpers.ts" />
- Iframe de mapa en el catálogo público (referencia de sandbox/lazy): <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/branch-map.tsx" />
- Tests unitarios: <ref_file file="C:/developer/paginas/pancheria/src/lib/maps.test.ts" />, <ref_file file="C:/developer/paginas/pancheria/src/application/services/branchService.test.ts" />
- Tests E2E del formulario de sucursal: <ref_file file="C:/developer/paginas/pancheria/tests/e2e/sucursal-contactos-y-turnos.spec.ts" />

## Estado actual relevante

- **El formulario solo valida al enviar.** `branch-form.tsx` dispara la server action y muestra un único `<p data-testid="branch-form-error">` con el error devuelto en `BranchState.error`. No hay feedback por campo mientras se completa: el admin descubre los errores recién al submit, uno por vez.
- **Bug reportado:** al pegar el código de "Insertar un mapa" de Google Maps (`<iframe src="https://www.google.com/maps/embed?pb=..." ...></iframe>`) el guardado falla con *"La ubicación no es una URL ni coordenadas válidas."* Causa: `tryBuildLocationUrl` (`src/lib/maps.ts`) solo acepta coordenadas `lat,lng` o una URL http(s) directa; el HTML del iframe no parsea como `URL` ni como coordenadas → `normalizeLocation` (`branchService.ts`) lanza `ValidationError`.
- **La ubicación guardada puede no ser embebible aunque sea válida.** `normalizeLocation` acepta cualquier URL http(s), pero `buildMapEmbedUrl` solo devuelve iframe para orígenes en `getMapsFrameOrigins()` (según `NEXT_PUBLIC_MAPS_PROVIDER`) y URLs ya embebibles o con coordenadas extraíbles (`mlat`/`mlon`, `#map=`, `query=lat,lng`). Un short link (`maps.app.goo.gl`) o una URL de Google tipo `/maps/place/...` se guardan bien pero en `/pedido` se ven solo como enlace "Ver en mapa" — el admin no tiene forma de saberlo hoy.
- **Los horarios se cargan franja por franja y día por día.** `branch-form.tsx` mantiene `openingHours: Slot[]` en estado con `toggleDay`/`addSlot`/`removeSlot`/`updateSlot`/`handleClearDay`. Si los 7 días tienen el mismo horario hay que cargar 7 veces lo mismo. La validación (formato `HH:mm`, `close !== open`, duplicados y solapamientos incluidos overnight) vive en `validateOpeningHours` (`branch-helpers.ts`), es TS puro y se puede invocar también del lado del cliente.
- **Los helpers de mapas ya son usables en cliente.** `branch-map.tsx` es `'use client'` e importa `buildMapEmbedUrl` sin problema (`src/config/maps.ts` solo lee `NEXT_PUBLIC_*`). Lo mismo aplica a `branch-helpers.ts`: `branch-form.tsx` ya importa de ahí `SOCIAL_NETWORK_OPTIONS` y `getSocialNetworkLabel`, así que `validateOpeningHours` corre en el bundle del cliente sin cambios. (`getBranchTimezone` vive en `src/config/branch.ts`, no en `branch-helpers.ts`, y solo lee `NEXT_PUBLIC_BRANCH_TIMEZONE`.)

## Objetivo

1. Que el formulario de sucursal valide los datos **mientras se completan los campos** (feedback inline por campo), empezando por la ubicación.
2. Que el campo **Ubicación** acepte el HTML del iframe de Google Maps (`<iframe src="...">`) y otros formatos comunes, extrayendo el `src`.
3. Que el admin vea una **preview real del mapa embebido** (iframe) debajo del campo ubicación cuando el valor sea embebible, o un mensaje claro cuando se guardará solo como enlace / sea inválido — antes de enviar el formulario.
4. Que se puedan **copiar las franjas horarias de un día y pegarlas en otro** para no cargar horarios repetidos a mano.

## Alcance

Aplicar cambios en:

- `src/lib/maps.ts` — extracción de `src` de un `<iframe>` y helper de estado de ubicación para la UI (ver §Reglas de negocio).
- `src/lib/branch-helpers.ts` — exportar helpers de validación por campo si hace falta (ej. patrón de teléfono), sin duplicar lógica.
- `src/components/sucursales/branch-form.tsx` — validación en vivo, preview de mapa, copiar/pegar horarios.
- Opcional: nuevo componente `src/components/sucursales/branch-location-preview.tsx` si conviene separar la preview del form.
- Tests: `src/lib/maps.test.ts`, `branchService.test.ts` (caso iframe), `tests/e2e/sucursal-contactos-y-turnos.spec.ts` o un spec nuevo.
- `AGENTS.md` / `guia-funcionamiento-pancheria.md` si cambian los formatos de ubicación aceptados (regla de documentación vigente).

No modificar:

- Esquema de base de datos ni migraciones (`branches.location` ya es texto).
- El contrato de `BranchState` ni los `data-testid` existentes (`branch-location`, `branch-form-error`, `branch-day-N-toggle`, `branch-slot-open-N-M`, etc.) — solo se agregan nuevos.
- La validación del servidor como fuente de verdad: todo lo validado en cliente debe seguir validándose en `branchService`/`branch-helpers`.
- La CSP: los orígenes embebibles ya están acotados por `getMapsFrameOrigins()`; no agregar dominios sueltos.

## Reglas de negocio

1. **Una sola fuente de verdad por formato de ubicación.** La lógica de interpretación del input vive en `src/lib/maps.ts` y la usan tanto el cliente (preview/validación) como el servidor (`normalizeLocation` → `tryBuildLocationUrl`). Nada de regex duplicadas en el componente.
2. **Aceptar HTML de iframe.** `tryBuildLocationUrl` (vía un helper interno `extractIframeSrc`) debe extraer el `src` de la etiqueta `<iframe ...>` con una regex **anclada al tag** — `/<iframe\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i` — tolerante a comillas simples/dobles, `src` sin comillas, atributos en cualquier orden y mayúsculas (`SRC=`). Una regex naive tipo `src="([^"]+)"` capturaría el primer `src=` del texto (p. ej. un `<img>` previo en HTML mixto); el `\b` antes de `src` además evita confundir `srcdoc=` con `src`. Decodificar `&amp;` → `&`. El `src` extraído **reemplaza al input** y continúa por el pipeline normal (coordenadas o URL http(s)); si no es válido, el input es inválido. La extracción falla cerrado: aunque la regex capture algo inesperado, el resultado pasa por `isValidLocationUrl` y cualquier cosa no-http(s) queda descartada. Rechazar cualquier otro HTML/JS: solo se extrae el atributo, nunca se renderiza el HTML pegado.
3. **Estado de la ubicación para la UI.** Exportar de `maps.ts` una función pura tipo `describeLocationInput(input): { status: 'empty' | 'invalid' | 'link' | 'embed'; embedUrl?: string }` que resuelva: vacío → `empty`; no parsea → `invalid`; parsea y `buildMapEmbedUrl` da URL → `embed` (con `embedUrl`); parsea pero no embebible → `link`. Internamente normaliza primero con `tryBuildLocationUrl` (que ya aplica `extractIframeSrc`, regla 2) y le pasa **esa URL normalizada** a `buildMapEmbedUrl` — nunca el input crudo; así el mismo pipeline clasifica coordenadas, HTML de iframe y URLs. El form consume eso y no reimplementa la clasificación.
4. **Preview fiel al comportamiento real.** La preview debe reflejar exactamente lo que verá el cliente en `/pedido`: si `buildMapEmbedUrl` devuelve `null`, el mensaje es "se mostrará como enlace" (no como error). Ojo: una URL de embed de Google solo previewa si el proveedor configurado es `google` (los orígenes permitidos dependen de `NEXT_PUBLIC_MAPS_PROVIDER`); el mensaje puede orientar al admin sin hardcodear dominios.
5. **(Recomendado) Más URLs de Google embebibles.** Extender `coordinatesFromMapUrl` para extraer coordenadas del patrón `/@lat,lng` del path de URLs de Google (`/maps/place/.../@-32.94,-60.63,17z/` y `/maps/@...`), con regex `/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)` sobre `pathname` — tolerante a enteros — y validación de rangos reutilizando `tryParseCoordinates` (mismo criterio que el resto del archivo: rechaza lat > 90, etc.). Así el enlace común de "Compartir" de Google pasa a mostrar mapa embebido. Documentar la decisión si se omite.
6. **Copiar/pegar horarios entre días.** Estado local `copied: { dayOfWeek: number; slots: { open: string; close: string }[] } | null` — el `dayOfWeek` origen se guarda para mostrar "Copiado de Lunes" (con opción a descartar, p. ej. botón × que haga `setCopied(null)`). En cada día habilitado, botón "Copiar" (`data-testid="branch-copy-day-N"`) que guarda el snapshot solo con `open`/`close` (sin `_id`); cuando hay algo copiado, los demás días muestran "Pegar" (`data-testid="branch-paste-day-N"`): reemplaza las franjas de ese día por las copiadas (nuevos `_id` via `generateSlotId`, `dayOfWeek` destino) y habilita el día si estaba apagado — `setOpeningHours(prev => [...prev.filter(s => s.dayOfWeek !== d), ...copied.slots.map(s => ({ ...s, dayOfWeek: d, _id: generateSlotId() }))])`. Si el día destino ya tenía franjas, el pegado las reemplaza (la acción es explícita del usuario; no hace falta confirmación modal, basta con que el botón sea claro). Limpiar `copied` tras un submit exitoso, junto al resto del estado del form.
7. **Validación en vivo sin bloquear.** El submit sigue habilitado (la validación final es del servidor), pero cada campo muestra su estado al completarlo: error inline (`role="alert"`, `aria-invalid`, `aria-describedby`) o hint de éxito/info. Mínimo: **ubicación** (estados de la regla 3) y **horarios** (envolver `validateOpeningHours(openingHours)` en try/catch en un `useMemo` — estado derivado puro, **no** `useEffect` + `setState` (ver la lección vigente sobre `setState` en `useEffect`) — y mostrar el `ValidationError.message` inline, p. ej. solapamiento entre días o `close === open`). Pasar `openingHours` directo: el validador ignora las props extra (`_id`), no hace falta mapear a objetos planos. Distinción UX: los estados `link`/`embed` de la ubicación son hints neutros/positivos y pueden mostrarse en vivo; el estado `invalid` solo se muestra si el campo ya fue **tocado** (flag en `onBlur` o tras un intento de submit), para no flashear "inválido" en cada keystroke intermedio. Valor agregado si el esfuerzo es bajo: `name` no vacío, número de teléfono contra el patrón existente y URL/handle de redes — reutilizando las mismas reglas de `branch-helpers.ts` (exportar lo que hoy es privado, sin duplicar).
8. **Idioma español** en textos de UI, comentarios y documentación. Sin dominios ni textos de configuración hardcodeados: lo que dependa del proveedor sale de `src/config/maps.ts`.

## Implementación detallada

### Backend / lib

- <ref_file file="C:/developer/paginas/pancheria/src/lib/maps.ts" />
  - Nueva función interna `extractIframeSrc(input: string): string | null` con la regex anclada al tag de la regla 2 (comillas simples/dobles/sin comillas, case-insensitive); devolver la URL limpia (`&amp;` → `&`) o `null`.
  - `tryBuildLocationUrl`: al inicio, `const effective = extractIframeSrc(trimmed) ?? trimmed;` y seguir el pipeline normal sobre `effective` (coordenadas → URL del proveedor; URL http(s) → tal cual). Así la regla 2 y esta sección dicen lo mismo: el `src` extraído es el nuevo input. Esto corrige el bug reportado sin tocar `branchService.ts` ni `actions.ts`.
  - `coordinatesFromMapUrl` (regla 5): agregar extracción de `/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)` del `pathname`, validando rangos con `tryParseCoordinates`.
  - Exportar `describeLocationInput` (regla 3) como puerta de entrada para la UI.
- <ref_file file="C:/developer/paginas/pancheria/src/lib/branch-helpers.ts" /> — solo si la validación en vivo de teléfonos/redes lo requiere: exportar validadores por valor (p. ej. `isValidPhoneNumber(value): boolean`, `isValidSocialTarget`) reutilizando las constantes actuales.
- `src/application/services/branchService.ts` — sin cambios esperados: `normalizeLocation` ya delega en `tryBuildLocationUrl`.

### Frontend

- <ref_file file="C:/developer/paginas/pancheria/src/components/sucursales/branch-form.tsx" />
  - Campo **Ubicación**: `const [locationInput, setLocationInput] = useState(branch?.location ?? '')` — en edición el preview arranca mostrando el estado actual — y `const locationDesc = useMemo(() => describeLocationInput(locationInput), [locationInput])`. Dos variantes válidas para el input: controlado (`value`/`onChange`) o `defaultValue` + `onChange` que solo alimente `locationInput` (así `form.reset()` sigue restaurando `defaultValue`). Mantener `name="location"` para el `FormData`. **Ojo con el reset**: en ambas variantes hay que resetear `locationInput` junto a `setOpeningHours([])`/`setPhones([])`/`setSocialLinks([])` en `handleSubmit` tras un alta exitosa (con `value`, además, `formRef.current?.reset()` ya no limpia el input). En cada cambio (debounce corto opcional) renderizar debajo:
    - `invalid` → mensaje de error inline (`data-testid="branch-location-error"`) con ejemplo de formato válido, **pero solo si el campo fue tocado** (`touched` en `onBlur` o tras intento de submit) — ver regla 7.
    - `link` → hint `text-muted-foreground`: "La ubicación es válida pero se mostrará como enlace 'Ver en mapa' (sin mapa embebido)." (`data-testid="branch-location-link-hint"`).
    - `embed` → preview **montada solo tras interacción**: botón/`<details>` "Ver preview" que monta el `<iframe src={embedUrl}>` (`data-testid="branch-location-preview"`, `loading="lazy"`, `title`, mismo `sandbox` que `branch-map.tsx`) más un texto "Así se verá el mapa en el catálogo". Es el patrón vigente (`lecciones-aprendidas.md`: el iframe se monta al abrir el `<details>`; `loading="lazy"` solo no evita que el proveedor reciba requests sin consentimiento) y de paso evita layout shift/requests mientras el input oscila entre `link`/`embed`. El iframe del panel queda cubierto por la misma CSP/`getMapsFrameOrigins` porque `embedUrl` solo proviene de orígenes permitidos.
    - Actualizar el texto de ayuda existente para mencionar que también se acepta el código completo del iframe de Google Maps.
  - **Horarios**: `useMemo` que corra `validateOpeningHours(openingHours)` en try/catch y muestre el mensaje inline (`data-testid="branch-hours-error"`) sobre la sección de días cuando haya error (solapamientos, cierre igual a apertura, etc.). Agregar estado `copied` + botones Copiar/Pegar por día según regla 6, con `aria-label` descriptivos ("Copiar horarios del Lunes", "Pegar horarios en Martes"). Los `name` del `FormData` (`openingHours[day][idx][open|close]`) se derivan del render y no cambian de contrato.
  - **Resto de campos** (regla 7, si aplica): `name` — marcar requerido inline si queda vacío tras blur; `phones` — hint si el número no matchea el patrón; `socialLinks` — hint si no es URL ni handle válido. Siempre como hints no bloqueantes junto al campo.
- El error global `branch-form-error` se mantiene para errores del servidor (nombre duplicado, etc.).
- Opcional de bajo costo: `minutesOf` está duplicado entre `branch-form.tsx` y `branch-helpers.ts` — se puede exportar el de `branch-helpers` y reutilizarlo.

### Tests

- `src/lib/maps.test.ts`: `tryBuildLocationUrl` con input `<iframe src="https://www.google.com/maps/embed?pb=...">` → devuelve la URL del src; iframe con `src` no-http → `null`; `describeLocationInput` para los 4 estados; extracción `/@lat,lng` si se implementa la regla 5. Casos borde de `extractIframeSrc`: `<img src="...">` sin `<iframe` → `null`; iframe con `srcdoc` y sin `src` → `null`; `src` con comillas simples, sin comillas o en mayúsculas (`SRC=`), y atributos en distinto orden; HTML mixto con `<img src>` **antes** del `<iframe>` (debe extraer el `src` del iframe, no el primero del texto); `&amp;` en el `src` decodificado a `&`.
- `src/application/services/branchService.test.ts`: `createBranch` con location = HTML de iframe de Google guarda la URL embebible (no el HTML).
- `tests/e2e/sucursal-contactos-y-turnos.spec.ts` (o spec nuevo `sucursal-form-ux.spec.ts`): 
  - Pegar iframe de Google en `branch-location` → preview/hint según el provider E2E. Ya verificado: `.env.e2e.example` **no define** `NEXT_PUBLIC_MAPS_PROVIDER`, así que E2E corre con el default `openstreetmap` → el iframe de Google da estado `link`: assert del hint/enlace (`branch-location-link-hint`) y del guardado correcto. Para cubrir el estado `embed` en E2E, pegar una URL de embed de OSM (ej. `https://www.openstreetmap.org/export/embed.html?bbox=...`), abrir el toggle "Ver preview" y hacer assert de `branch-location-preview` (basta `src`/visibilidad: el iframe no necesita cargar la red externa). Usar `waitForHydratedInput` sobre `branch-location` antes del `fill` (el campo pasa a tener estado asociado).
  - Copiar horarios del Lunes y pegar en Martes → las franjas del Martes quedan iguales (`toHaveValue` en `branch-slot-open-2-0`, etc.).
  - Horarios solapados → `branch-hours-error` visible antes de submit.
- Recordar la lección de E2E: usar `waitForHydratedInput` antes de `fill()` en inputs controlados y limpiar datos residuales en `finally`.

## Consideraciones de seguridad y entorno

- El HTML pegado en ubicación **nunca se renderiza**: solo se extrae el atributo `src` y se valida http(s) + origen permitido antes de embeber. Nada de `dangerouslySetInnerHTML`.
- El iframe de preview usa el mismo `sandbox` que `branch-map.tsx` y solo URLs de `buildMapEmbedUrl` (orígenes de `getMapsFrameOrigins()`) — no se amplía la CSP.
- No hardcodear dominios de mapas ni credenciales; todo via `NEXT_PUBLIC_MAPS_PROVIDER` / `NEXT_PUBLIC_MAPS_BASE_URL`.
- Ejecutar E2E solo con `.env.e2e` contra base descartable (el `global-setup.ts` trunca tablas).

## Verificaciones

| Comando | Propósito |
| ------- | --------- |
| `npm run lint` | Estilo y calidad |
| `npx tsc --noEmit` | Verificación de tipos |
| `npm test` | Tests unitarios (maps, branchService) |
| `npm run build` | Build de producción |
| `npm run knip` | Código muerto |
| `npm run test:e2e` (o `NO_WEB_SERVER=1 npx playwright test <spec>`) | Specs de sucursales en base descartable |

Verificación manual: en `/sucursales`, crear sucursal pegando el iframe de "Insertar mapa" de Google → debe guardarse y mostrar preview/enlace según provider; copiar horarios de un día a otros dos y guardar; revisar `/pedido` para confirmar el mapa.
