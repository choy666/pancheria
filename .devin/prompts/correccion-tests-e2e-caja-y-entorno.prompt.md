# Prompt: Corrección de tests E2E fallidos — caja, stock y entorno

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16.3.2 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5, Jest, Playwright.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/guia-funcionamiento-pancheria.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/scripts/dev-e2e.ts" />

## Estado actual relevante

La auditoría más reciente dejó el suite E2E en:
- `npm run test:e2e` — **84 passed, 0 failed**.
- `npm test` — 92 suites, 890 tests passed.
- `npm run build`, `npx tsc --noEmit` y `npm run lint` — OK.

La causa raíz de los fallos anteriores fue doble:

1. **Entorno del `webServer` de Playwright.** El `playwright.config.ts` anterior levantaba `npm run dev` sin cargar `.env.e2e` y esperaba a que `http://localhost:3000` respondiera. Con Next.js 16 + Turbopack, las rutas API se compilan bajo demanda, por lo que las primeras requests recibían HTML/404 mientras se compilaban.
2. **Locadores no robustos.** `tests/e2e/caja-cierre-vacios.spec.ts` usaba `filter({ hasText: supply.name })` sin `.first()`, lo que fallaba cuando existían productos con nombres similares (por ejemplo `Pan` y `Pan E2E`).

## Objetivo

Mantener y fortalecer el suite de tests E2E para que `npm run test:e2e` siga pasando en una base de datos descartable, sin romper `npm test`, `npm run build`, `npx tsc --noEmit` ni `npm run lint`.

## Reglas de negocio

1. El `webServer` de Playwright debe cargar `.env.e2e` y esperar a que una ruta API responda antes de iniciar tests.
2. Los helpers E2E deben fallar con mensajes descriptivos que incluyan `status` y `body` cuando una respuesta no es JSON.
3. Los tests E2E solo pueden ejecutarse contra una base de datos descartable, nunca contra producción ni datos reales.
4. `NEXT_PUBLIC_WHATSAPP_NUMBER` no debe bloquear la creación de pedidos en tests.
5. Los locators de Playwright deben ser robustos a productos con nombres parcialmente coincidentes.
6. `createProductViaApi` crea productos con `stock: 0`; la carga inicial se hace con `restockProductViaApi` (`type: 'restock'`).

## Implementación detallada

### 1. Entorno E2E — `playwright.config.ts` y `scripts/dev-e2e.ts`

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/playwright.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/scripts/dev-e2e.ts" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />

Acciones:
- Asegurar que `playwright.config.ts` use `command: 'npm run dev:e2e'` y `url: 'http://localhost:3000/api/caja/resumen'` en `webServer`. Esto fuerza a Turbopack a compilar una ruta API antes de que Playwright considere el servidor listo.
- Asegurar que `scripts/dev-e2e.ts` cargue `.env.e2e` con `dotenv.config({ path: '.env.e2e', override: true })` antes de importar el binario de Next.js.
- Asegurar que `package.json` tenga el script `"dev:e2e": "tsx scripts/dev-e2e.ts"`.
- Si se prefiere levantar manualmente, usar `npm run dev:e2e` y luego `NO_WEB_SERVER=1 npx playwright test`.

### 2. Helpers de E2E — `tests/e2e/helpers.ts`

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/helpers.ts" />

Acciones:
- Mantener el manejo defensivo en `getCashRegister` y `restockProductViaApi`:
  - Verificar `content-type` de la respuesta.
  - Si no es JSON, imprimir `status` y `body` y lanzar un error descriptivo.
- Si `login` no deja la cookie en el contexto de Playwright, agregar un `page.goto('/')` post-login o usar `storageState`.

### 3. Tests E2E con locators robustos

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/tests/e2e/caja-cierre-vacios.spec.ts" />

Acciones:
- Cuando se itera sobre productos con `filter({ hasText: name })`, usar `.first()` para evitar strict mode violations cuando existen productos con nombres parcialmente coincidentes.
- Si se busca un `li` con un insumo crítico y su cantidad, preferir `getByRole('listitem').filter({ hasText: name }).first()` en lugar de asumir que el texto completo es único.

### 4. Entorno E2E — `.env.e2e`

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/.env.e2e" />
- <ref_file file="C:/developer/paginas/pancheria/.env.example" />

Acciones:
- Mantener placeholders para `DATABASE_URL` y `DATABASE_URL_UNPOOLED` de una base descartable, con un comentario claro indicando que deben completarse antes de correr E2E.
- Asegurar que `ADMIN_USERNAME` y `ADMIN_PASSWORD` coincidan con el seed (`src/db/seeds.ts`).
- Mantener `STORAGE_PROVIDER=local` y `LOCAL_STORAGE_PATH=tmp/e2e/chat` para no tocar Vercel Blob en tests.
- Considerar `NEXT_PUBLIC_WHATSAPP_NUMBER=` vacío o un número de prueba para evitar que los tests de pedidos dependan de WhatsApp.

### 5. Frontend y flujo de pedidos

Revisar:
- <ref_file file="C:/developer/paginas/pancheria/src/app/(public)/pedido/page.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/components/pedido/pedido-client.tsx" />
- <ref_file file="C:/developer/paginas/pancheria/src/application/services/orderService.ts" />

Acciones:
- Confirmar que el mensaje `Pedido creado` (o similar) se renderiza tras una creación exitosa.
- Revisar `createOrder` para que no falle silenciosamente ni devuelva HTML; manejar errores de conexión con `503` JSON.

## Consideraciones de seguridad y entorno

- No hardcodear credenciales, URLs de base de datos ni secretos en el prompt ni en el código.
- `.env.e2e` es un archivo de configuración; si se commitea, debe contener solo placeholders, nunca valores reales.
- No ejecutar `npm run test:e2e` sin confirmar que `DATABASE_URL` apunta a una base descartable.
- Si se expuso `.env.local` durante la auditoría, rotar `NEXTAUTH_SECRET`, `ADMIN_PASSWORD` y credenciales de Neon/Vercel Blob.

## Verificaciones

Antes de declarar terminada la tarea, ejecutar en este orden:

| Paso | Comando | Propósito |
| ---- | ------- | --------- |
| 1 | `npm run lint` | Estilo y calidad |
| 2 | `npx tsc --noEmit` | Verificación de tipos |
| 3 | `npm test` | Tests unitarios |
| 4 | `npm run build` | Build de producción |
| 5 | Configurar `.env.e2e` con base descartable | Aislar datos reales |
| 6 | `npm run test:e2e` | Validar flujos E2E |

## Criterio de aceptación

- `npm run test:e2e` debe reportar **84 passed, 0 failed**.
- `GET /api/caja/resumen` debe devolver JSON en todas las condiciones: sesión inválida (401), sesión sin sucursal (403), caja cerrada (`{ status: 'closed' }`) y caja abierta (objeto de resumen).
- `POST /api/stock/ajustar` debe devolver 200 en el flujo de `restockProductViaApi` cuando el usuario está autenticado.
- Los flujos de pedidos deben mostrar confirmación de creación sin depender de un número de WhatsApp real.
