# Prompt: Auditoría y corrección de tests E2E fallidos — caja (timeout de login) y rate limit de pedidos (429) — Archivado

> **Resuelto.** Las correcciones propuestas en este prompt ya están aplicadas: `tests/e2e/helpers.ts` agrega `clearSession(page)` y robustece `loginAs`; `.github/workflows/ci.yml` y `.env.e2e.example` configuran `E2E_ENABLE_RATE_LIMIT=true`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` y `TRUSTED_PROXY_IP_HEADER=X-Forwarded-For`; el suite E2E reporta **96 passed**. Se conserva este archivo como contexto histórico.

## Contexto

Proyecto: `panchería` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos con reproducción y Cast.

Stack: Next.js 16.3.3 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/entornos.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/README.md" />
- <ref_file file="C:/developer/paginas/pancheria/.env.e2e.example" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />

## Estado actual relevante

El CI de GitHub Actions reporta **2 tests E2E fallidos** sobre un total de 96:

1. `tests/e2e/caja-aislamiento-y-trazabilidad.spec.ts` — `un operador no puede acceder a la caja de otra sucursal`:
   - Timeout esperando `getByLabel('Usuario')` dentro de `loginAs` después de `page.context().clearCookies()`.
   - La causa no es la falta de `page.goto('/login')` (el helper ya lo hace), sino que `clearCookies` puede no invalidar completamente la sesión de NextAuth v5, por lo que `/login` redirige silenciosamente a `/` cuando `session?.user` sigue presente.

2. `tests/e2e/rate-limit-pedidos.spec.ts` — `bloquea la tercera solicitud con 429`:
   - La tercera `POST /api/public/pedido` devuelve `201` en lugar de `429`.
   - El workflow de CI no define `E2E_ENABLE_RATE_LIMIT=true`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2` ni `TRUSTED_PROXY_IP_HEADER=X-Forwarded-For`, por lo que en `NODE_ENV=test` el rate limit se desactiva o, si se activara, agruparía todas las requests bajo el IP `unknown` con un límite de 10.

## Objetivo

1. Corregir el flujo de logout/login entre tests E2E para que `clearCookies()` + `loginAs()` sea robusto y determinista.
2. Configurar el entorno E2E (`.env.e2e.example` y `.github/workflows/ci.yml`) para que el test de rate limit reciba `429` en la tercera solicitud.
3. Documentar las variables de entorno requeridas y el patrón de logout en tests.
4. Ejecutar `npm run test:e2e` contra una base descartable y confirmar que ambos tests pasan.

## Reglas de negocio y consideraciones

1. No hardcodear credenciales, URLs de base de datos ni secretos.
2. Los tests E2E solo pueden ejecutarse contra una base de datos descartable cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`.
3. `tests/e2e/global-setup.ts` trunca tablas de negocio y re-seedea; no correr en base de producción ni con datos reales.
4. El rate limit de pedidos públicos está deshabilitado por defecto en `NODE_ENV=test` salvo que `E2E_ENABLE_RATE_LIMIT=true`.
5. `getClientIp` no confía en `X-Forwarded-For` en `NODE_ENV=test` a menos que `TRUSTED_PROXY_IP_HEADER` esté definido.
6. El límite por defecto de pedidos públicos es 10 (`PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS`); el test de E2E requiere un límite de 1 o 2.
7. `clearCookies()` del contexto de Playwright no invalida una sesión JWT si queda alguna cookie residual o si el server component redirige antes de que el cliente la descarte.

## Implementación detallada

### 1. Robustecer el helper de login (`tests/e2e/helpers.ts`)

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/(auth)/login/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/lib/route-guard.ts" />

Acciones:
- Cambiar `loginAs` para navegar a `/login` con una espera explícita y verificar la URL y el formulario antes de interactuar:
  ```ts
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 60_000 });
  await expect(page).toHaveURL('/login', { timeout: 10_000 });
  await expect(page.getByLabel('Usuario')).toBeVisible({ timeout: 15_000 });
  ```
- Si `expect(page).toHaveURL('/login')` falla, lanzar un error descriptivo indicando que la sesión no se limpió o que la página redirigió a `/`.
- Crear un helper `clearSession(page)` que combine:
  - `await page.goto('/login');`
  - `await page.context().clearCookies();`
  - `await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });`
  - (Opcional) una llamada a signOut si se expone un endpoint confiable.
- Reemplazar los `page.context().clearCookies()` sueltos en `tests/e2e/caja-aislamiento-y-trazabilidad.spec.ts`, `tests/e2e/videos.spec.ts`, `tests/e2e/pedido.spec.ts` y `tests/e2e/pedido-sucursal-y-stock.spec.ts` por `await clearSession(page)`.

### 2. Revisar el test de caja (`tests/e2e/caja-aislamiento-y-trazabilidad.spec.ts`)

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/caja-aislamiento-y-trazabilidad.spec.ts" />

Acciones:
- Reemplazar `await page.context().clearCookies();` por `await clearSession(page);` antes del segundo login.
- Confirmar que `cashRegisterId` se extrae correctamente del heading `Caja #\d+`.
- Confirmar que `getTestSecondBranch` devuelve un operador con sucursal asignada.

### 3. Configurar rate limit para E2E

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/src/lib/rate-limit.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/config/orders.ts" />
- <ref_file file="C:/developer/paginas/pancheria/src/app/api/public/pedido/route.ts" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/.github/workflows/ci.yml" />
- <ref_file file="C:/developer/paginas/pancheria/.env.e2e.example" />

Acciones:
- Actualizar `.github/workflows/ci.yml` en el job `e2e` para agregar:
  ```yaml
  E2E_ENABLE_RATE_LIMIT: true
  PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER: memory
  PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS: 2
  TRUSTED_PROXY_IP_HEADER: X-Forwarded-For
  ```
- Actualizar `.env.e2e.example` para descomentar o resaltar:
  ```bash
  E2E_ENABLE_RATE_LIMIT=true
  PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=memory
  PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS=2
  TRUSTED_PROXY_IP_HEADER=X-Forwarded-For
  ```
- Considerar actualizar `playwright.config.ts` para que `webServer.env` pase `E2E_ENABLE_RATE_LIMIT=true` por defecto cuando se ejecute el suite E2E, en lugar de `process.env.E2E_ENABLE_RATE_LIMIT ?? ''`. Evaluar si esto afecta a otros tests que no esperen rate limit.
- Opcional: en `tests/e2e/rate-limit-pedidos.spec.ts`, usar una IP única por test (por ejemplo `203.0.113.${uniqueId}`) para evitar que el contador compartido de `unknown` o de un IP fijo contamine resultados entre tests.

### 4. Documentación de variables de entorno

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />

Acciones:
- Asegurar que `AGENTS.md` mencione que `E2E_ENABLE_RATE_LIMIT`, `PUBLIC_ORDER_RATE_LIMIT_MAX_REQUESTS` y `TRUSTED_PROXY_IP_HEADER` son requeridas para el test E2E de rate limit.
- Asegurar que `.env.example` documente `E2E_ENABLE_RATE_LIMIT` y su relación con `NODE_ENV=test`.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, secretos ni URLs de API.
- `.env.e2e` y `.env.local` no deben commitearse con valores reales.
- `TRUSTED_PROXY_IP_HEADER` solo debe confiar en headers que provengan de un proxy controlado. En E2E local no hay riesgo; en producción debe configurarse al header que provee el proxy (por ejemplo `x-vercel-forwarded-for`).
- Ejecutar `npm run test:e2e` solo contra bases descartables.
- Si se expuso `NEXTAUTH_SECRET`, `ADMIN_PASSWORD` o URLs de base de datos durante la auditoría, rotarlas.

## Verificaciones antes de declarar terminada la tarea

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
| 5 | Configurar `.env.e2e` con base descartable | Aislar datos reales |
| 6 | `npm run test:e2e -- tests/e2e/caja-aislamiento-y-trazabilidad.spec.ts tests/e2e/rate-limit-pedidos.spec.ts` | Validar tests afectados |
| 7 | `npm run test:e2e` | Validar suite completo |

## Criterio de aceptación

- `un operador no puede acceder a la caja de otra sucursal` pasa de forma determinista, incluso en la primera ejecución del test y en CI.
- `bloquea la tercera solicitud con 429` devuelve `429` en la tercera request y el body contiene `Demasiados pedidos`.
- `npm run test:e2e` reporta **0 fallos** en base de datos descartable.
- Los cambios en `tests/e2e/helpers.ts` no rompen otros tests que usen `loginAs`, `loginAsAdmin` o `loginAsOperator`.
- `AGENTS.md`, `.env.example` y `.env.e2e.example` reflejan las variables requeridas para E2E con rate limit.
