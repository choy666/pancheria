---
name: context7-stack
description: IDs de Context7 pre-resueltos para las dependencias del proyecto Panchería. Consultar esta tabla antes de llamar `resolve-library-id` y usar `query-docs` directamente con el ID correspondiente.
---

# Context7 — Stack del proyecto Panchería

El MCP `context7` expone dos tools: `resolve-library-id` (buscar el ID de una librería) y `query-docs` (consultar documentación). Esta tabla ya tiene los IDs resueltos para las dependencias de `package.json`: **llamar `query-docs` directamente** y reservar `resolve-library-id` para paquetes no listados o resultados que no parezcan correctos.

## Mapeo paquete → Context7 ID

| Paquete (`package.json`) | Versión local | Context7 ID | Notas |
| --- | --- | --- | --- |
| `next` | ^16.3.3 | `/vercel/next.js` | Tags disponibles hasta `v16.2.9`; para comportamiento específico de la 16 usar `/vercel/next.js/v16.2.9`. Recordar: `proxy.ts` (ex `middleware.ts`), Turbopack por defecto. |
| `react` / `react-dom` | 19.2.8 | `/reactjs/react.dev` | Documentación oficial. `/react/react` tiene el tag exacto `v19.2.8` si hace falta la fuente del repo. |
| `next-auth` | ^5.0.0-beta.32 | `/nextauthjs/next-auth` | v5 se documenta como "Auth.js": API nueva vs v4 (`auth()`, `AUTH_URL`/`AUTH_SECRET`, proxy con `auth` export). |
| `drizzle-orm` | ^0.45.2 | `/drizzle-team/drizzle-orm-docs` | Alternativa con más snippets: `/websites/orm_drizzle_team`. |
| `drizzle-kit` | ^0.31.10 | `/drizzle-team/drizzle-orm-docs` | La doc del CLI (`generate`, `push`, `migrate`, `check`) vive en el mismo set. `/drizzle-team/drizzle-orm` tiene el tag `drizzle-kit_0.31.5`. |
| `tailwindcss` | ^4 | `/tailwindlabs/tailwindcss.com` | Sitio oficial v4: configuración CSS-first con `@theme` (no `tailwind.config.js`). |
| `zod` | ^4.4.3 | `/colinhacks/zod/v4.3.6` | **Fijar v4**: la API cambió respecto a v3 (`z.email()`, `z.treeifyError`, `z.strictObject`, etc.). Sin pin: `/colinhacks/zod`. |
| `@playwright/test` | ^1.62.1 | `/microsoft/playwright` | Tags cercanos: `v1.61.0`, `v1.63.0`. |
| `@axe-core/playwright` | ^4.13.0 | `/dequelabs/axe-core` | El wrapper de Playwright es fino; reglas, tags (`wcag2a/aa`) y `AxeBuilder` se documentan en axe-core. |
| `jest` | ^30.4.2 | `/websites/jestjs_io_30_0` | Docs del sitio para Jest 30. `ts-jest`: `/kulshekhar/ts-jest`. |
| `@testing-library/react` | ^16.3.2 | `/testing-library/testing-library-docs` | Sitio de docs de `@testing-library/*` (queries, `waitFor`, `userEvent`, `renderHook`). |
| `@neondatabase/serverless` | ^1.1.0 | `/neondatabase/website` | Sitio completo de Neon (driver serverless, pooling, branches para bases E2E). |
| `pg` | ^8.22.0 | `/websites/node-postgres` | Pool, transacciones y timeouts — usado por `src/db/index.ts`. |
| `@vercel/blob` | ^2.8.0 | `/vercel/storage` | Blob se documenta dentro de Vercel Storage. |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-presigned-post` | ^3.1110.0 | `/aws/aws-sdk-js-v3` | Aplica también a R2 (API compatible S3 con endpoint custom). |
| `date-fns` | ^4.4.0 | `/date-fns/date-fns` | Para zonas horarias (`NEXT_PUBLIC_BRANCH_TIMEZONE`, turnos overnight de sucursales/caja): `/date-fns/tz` (`TZDate`). |
| `dinero.js` | ^2.0.2 | `/dinerojs/dinero.js` | Aritmética de dinero inmutable; el proyecto la envuelve en `src/lib/money.ts`. |
| `@base-ui/react` | ^1.6.0 | `/mui/base-ui/v1.6.0` | Tag exacto disponible para la versión instalada. |
| `shadcn` (CLI) | ^4.16.1 | `/shadcn-ui/ui` | Componentes y registry; tag cercano `shadcn_4.21.0`. |
| `driver.js` | ^1.8.0 | `/websites/driverjs` | Tours de onboarding del panel. |
| `lucide-react` | ^1.28.0 | `/websites/lucide_dev` | Nombres de íconos y props del paquete React. |

Paquetes con baja frecuencia de consulta (resolver en el momento si hace falta): `bcrypt`, `nanoid`, `clsx`, `tailwind-merge`, `class-variance-authority`, `tw-animate-css`, `@next/bundle-analyzer`, `eslint`, `typescript`, `knip`, `tsx`, `dotenv`, `cross-env`, `@types/*`.

## Reglas de uso en este proyecto

- **Fijar versión** (`/org/project/version`) cuando el comportamiento dependa de ella: `zod` v4, `next-auth` v5, `tailwindcss` v4, `next` 16, `@base-ui/react` 1.6.
- **Una query por concepto.** Si la duda cruza varios temas (p. ej. cacheo y middleware en Next), una llamada a `query-docs` por concepto con el mismo ID.
- **Seguridad:** nunca incluir secretos, valores de `.env`, credenciales ni código propietario en `query`/`libraryName` — las queries se envían a la API de Context7.
- **No usar Context7 para:** lógica de negocio del repo, refactors, debugging propio ni revisión de código. Para eso están `.devin/informes/` (arquitectura, lecciones aprendidas, checklist pre-push).
- Preferir Context7 sobre `web_search` para documentación de librerías; para explorar repositorios también está el MCP `deepwiki`.
