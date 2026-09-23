# Auditoría QA — Ronda 2 (2026-09-23)

Segunda ronda de la auditoría QA iniciada el 2026-09-21 (ver `auditoria-qa-2026-09-21.md` y `e4-sucursal-eliminada.md`). Alcance: CSP contra build de producción (`next start`), confianza en `X-Forwarded-For` en producción y revisión visual cualitativa con emulación de daltonismo.

## 1. CSP contra build de producción

### Hallazgo P0 — `/pedido/seguimiento` no hidrataba en producción (corregido)

**Síntoma**: la página pública de seguimiento era la única de contenido marcada `○ (Static)` en el build. Su HTML quedaba prerenderizado **sin nonce**; al servirse con `script-src 'nonce-…'` por request, el navegador bloqueaba los inline scripts del bootstrap de Next (`self.__next_f.push`).

**Evidencia local** (`next build` + `next start` + Chromium):

- 2 violaciones CSP de inline script en consola y React error #412 (hydration failure).
- 0 scripts con nonce en el DOM servido; el submit del formulario de seguimiento no hacía nada.

**Por qué E2E nunca lo vio**: `dev:e2e` (Turbopack dev) renderiza todo por request con nonce fresco; el prerender estático solo existe en builds de producción.

**Corrección**: `export const dynamic = 'force-dynamic'` en `src/app/(public)/pedido/seguimiento/page.tsx` (misma convención que `/pedido` y `/pedido/[id]/chat`) + test de regresión en `page.test.tsx` que verifica el export.

**Verificación post-fix**: la ruta quedó `ƒ`, 0 scripts sin nonce, 0 violaciones CSP, formulario funcional en `next start`. E2E `pedido-seguimiento.spec.ts` 5/5.

### Verificado sin hallazgos

- `src/proxy.ts` genera nonce por request (`crypto.randomUUID()`), lo propaga como `x-nonce` y Next 16.3.3 lo aplica a todos sus scripts (inline y externos) con valor consistente por request y distinto entre requests.
- CSP de producción correcta: sin `'unsafe-eval'`, con `upgrade-insecure-requests`.
- Panel completo (9 páginas con sesión admin) navegado en `next start`: cero violaciones CSP.
- `useCast` (gstatic), mapa OSM (`frame-src`) y analytics condicional dentro de la política.

### Observaciones (no son defectos)

- `/_vercel/insights/script.js` devuelve 404/MIME error en `next start` local: el endpoint solo existe en despliegues Vercel reales (documentado en `conditional-analytics.tsx`).
- Los redirects del route-guard usan `AUTH_URL` como origen absoluto (comportamiento de NextAuth): correcto en producción donde `AUTH_URL` = dominio público. **Caveat**: en preview deployments con dominio distinto de `AUTH_URL`, los redirects de auth rebotarían al dominio productivo.
- Requests `Script → /login` con `ERR_SSL_PROTOCOL_ERROR` en local: subrecursos que siguen un 307 del route-guard y `upgrade-insecure-requests` los convierte a https. En producción sería un error MIME cosmético, no funcional.
- `/_not-found` también es estática (impacto menor: el navbar del 404 no hidrataría, pero su `<Link>` funciona como anchor nativo sin JS). No se forzó a dynamic para no convertir cada 404 en render de servidor; queda como observación.

## 2. Confianza en `X-Forwarded-For` en producción

**Veredicto: el diseño es fail-closed y correcto.** `getClientIp` (`src/lib/rate-limit.ts`) resuelve la IP en este orden:

1. `x-vercel-forwarded-for` cuando corre en Vercel (header controlado por el edge).
2. El header configurado por `TRUSTED_PROXY_IP_HEADER` (proxy explícito).
3. `X-Forwarded-For` libre solo en desarrollo.
4. En producción, `X-Forwarded-For` solo con el opt-in `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS=true`.
5. Sin fuente confiable en producción: lanza error (fail-closed, el request no se procesa).

El rate limit de login es por **username** (`login_attempts`), no por IP: inmune a spoofing de XFF.

### Hallazgo menor corregido — info-leak de configuración

El rechazo fail-closed lanzaba `DomainError` → `withApiErrorHandling` lo mapeaba a **400 con el mensaje al cliente**, que nombraba `TRUSTED_PROXY_IP_HEADER` y `PUBLIC_RATE_LIMIT_TRUST_PRIVATE_IPS`. Se introdujo `RateLimitConfigError extends Error` (sin herencia de `DomainError`): cae en el catch-all → **500 genérico al cliente** y el detalle completo queda en logs vía `logApiError`. Tests actualizados (41/41 en `rate-limit.test.ts`).

## 3. Revisión visual con daltonismo

**Veredicto: sin hallazgos.** 25 screenshots con `Emulation.setEmulatedVisionDeficiency` de CDP (deuteranopia, protanopia, tritanopia, achromatopsia) sobre `/pedidos`, `/pedido`, `/` (panel), `/ventas`, `/productos`, más revisión de código:

- Estados de pedido: `Badge` con **texto** (`statusLabels`) — nunca color-solo.
- Alertas de caja: icono ⓘ/⚠ + texto completo.
- Diferencias monetarias de caja: signo `+`/`-` explícito además del color.
- Estado del catálogo público: punto indicador + texto ("Cerrado ahora · Abre…").
- Métodos de pago y acciones: icono + etiqueta de texto.
- Badge de mensajes sin leer: número + `aria-label`.
- En achromatopsia todo permanece legible (tema oscuro, contraste suficiente).

El color actúa como refuerzo visual; la semántica siempre viaja por texto o iconos. Evidencia descartable en `.devin/informes/shots/` (no versionada).

## 4. Estado de deuda registrada (sin cambios)

- `ci-e2e-base-compartida.md`: deadlocks por `global-setup` concurrente sobre la misma base Neon — propuesta `concurrency: { group: e2e-db }` pendiente de autorización.
- Soft-delete de `branches`: para la próxima auditoría de escalabilidad.

## Verificaciones de la ronda

- `npm run build` ✓ (`/pedido/seguimiento` ahora `ƒ`)
- `npx tsc --noEmit` ✓ · `npm run lint` ✓ (solo warning preexistente de `sign-out-client.tsx`) · `npm run knip` ✓
- `npm test`: 175 suites / 1882 tests ✓
- `npm run test:e2e -- tests/e2e/pedido-seguimiento.spec.ts`: 5/5 ✓
- Verificación empírica CSP en `next start` (puerto 3100): 0 violaciones, formulario funcional.
