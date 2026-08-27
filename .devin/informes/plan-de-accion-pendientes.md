# Plan de acción — Cierre de pendientes post-auditoría `.devin`

**Fecha:** 2026-08-26 (actualizado con Fase 2)  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Este plan detalla las acciones necesarias para resolver las recomendaciones de `.devin/informes/reporte-estado.md` y otras deudas documentales/configuración detectadas. Se divide en:

- **Acciones ya aplicadas en esta sesión:** correcciones en `AGENTS.md`, `lecciones-aprendidas.md`, `environment.yaml`, `.devin/prompts/README.md`, `.devin/informes/README.md`, `guia-funcionamiento-pancheria.md` y `reporte-estado.md`.
- **Acciones que requieren autenticación externa:** verificación del blueprint de Devin (`devin.exe auth login`).
- **Acciones que requieren base de datos de prueba:** ejecución completa de `npm run test:e2e`.
- **Acciones de mantenimiento continuo:** revisión de archivados y sincronización de `.devin` con cada cambio arquitectónico.

El objetivo es dejar los pendientes con un dueño, un criterio de salida y una verificación reproducible.

---

## 2. Estado de los pendientes

| # | Pendiente | Estado | Riesgo | Bloqueante | Acción inmediata | Verificación |
|---|---|---|---|---|---|---|
| 1 | Verificar blueprint de Devin | Pendiente | Medio | Requiere `devin.exe auth login` y acceso al repositorio en GitHub | Ejecutar `devin.exe cloud drs blueprint-create` y `devin.exe cloud drs build`; corregir `.devin/environment.yaml` si falla. El uso de `uses: github.com/actions/setup-node@v4` es válido según la documentación oficial de DRS. | `devin.exe cloud drs build` finaliza exitosamente. |
| 2 | Correr E2E en base de prueba | Completado previamente | Alto (datos) | Ninguno | Ejecutar `npm run test:e2e` con base local descartable (`pancheria_e2e`) y `.env.e2e` configurado. | `94 passed, 1 skipped` en 12.8m; sin datos reales afectados. |
| 3 | Revisar archivados | En revisión | Bajo | Decisión sobre valor histórico | Aplicar criterios del plan; proponer eliminación de archivos obsoletos/peligrosos. | Índices actualizados y archivos redundantes removidos con confirmación. |
| 4 | Mantener `.devin` sincronizado | En curso | Medio | Disciplina del equipo | Usar el checklist de sincronización en `.devin/prompts/auditoria-y-documentacion.md` y `.devin/informes/lecciones-aprendidas.md`. | Cada cambio arquitectónico incluye documentación. |
| 5 | Falsos positivos de CI | Documentado | Bajo | Validación del IDE | No modificar `.github/workflows/ci.yml`; documentar causas y opción de pin a SHA. | `npm run lint` pasa; workflow sin cambios innecesarios. |
| 6 | Revisar `knip.json` | Resuelto | Bajo | Ninguno | Se agregó `tests/e2e/helpers.ts` y `tests/e2e/**/*.spec.ts` como puntos de entrada para evitar falsos positivos por exports de helpers de E2E. | `npm run knip` pasa. |
| 7 | Hardcodeos defensivos | Resuelto | Bajo | Ninguno | `getPublicBaseUrl()` ahora requiere `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL` en producción y acepta `HOST`/`PORT` en desarrollo/test. `getWhatsAppMessageParts()` lee variables de entorno sin defaults; los valores sugeridos pasaron a `.env.example`. | `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip` pasan. |
|| 8 | Aplicar migración Fase 2 a producción | Completado | Alto (datos) | Ninguno | Aplicado `drizzle/0017_unknown_energizer.sql` en producción con `DATABASE_URL_UNPOOLED`; verificado que `opening_hours` existe con default `[]` y la sucursal por defecto conserva `opening_hours = []`. | `npx drizzle-kit push --force` finalizó sin errores; pedidos y sucursales siguen operativos. |

---

## 3. Verificar blueprint de Devin (DRS)

### Requisitos

- `devin.exe auth login` configurado en la máquina local.
- Acceso al repositorio en GitHub (sustituir `<owner/repo>` por el valor real).
- Archivo `.devin/environment.yaml` vigente.

### Pasos

1. `devin.exe auth login`
2. `devin.exe cloud drs blueprint-create --repo <owner/repo> --from-file .devin/environment.yaml`
3. `devin.exe cloud drs build`
4. Si el build falla por dependencias, variables de entorno o comandos:
   - Corregir `.devin/environment.yaml` sin hardcodear secretos.
   - El bloque `initialize` con `uses: github.com/actions/setup-node@v4` es válido según la documentación oficial de DRS (soporta referenciar GitHub Actions). Si el build falla por este paso, revisar que el action esté accesible desde el entorno de Devin Cloud.
   - Repetir el build.
5. Registrar el resultado en `.devin/informes/reporte-estado.md` y cerrar este plan cuando se complete.

> **Nota:** este paso no se pudo ejecutar en la sesión actual porque `devin.exe auth login` no estaba configurado.

---

## 4. Correr E2E en base de prueba

### Requisitos

- PostgreSQL local, un contenedor Docker o una rama de Neon descartable.
- `.env.e2e` con `DATABASE_URL` y `DATABASE_URL_UNPOOLED` apuntando a una base descartable.
- `ADMIN_USERNAME` y `ADMIN_PASSWORD` consistentes con el seed.
- `AUTH_URL`, `NEXTAUTH_URL` y `BASE_URL` apuntando a `http://localhost:3000`.

> **Advertencia:** `tests/e2e/global-setup.ts` trunca las tablas `products`, `recipes`, `sales`, `sale_items`, `orders`, `order_items`, `order_messages`, `stock_movements`, `cash_registers`, `daily_closures`, `public_order_rate_limits`, `login_attempts`, `videos`, `users` y `branches`. Nunca correr E2E contra una base con datos reales.

### Pasos

1. Verificar que la URL de base de datos sea local o tenga un sufijo `test`, `e2e`, `qa` o `staging`. `global-setup.ts` aborta si no cumple esta condición.
2. Copiar el ejemplo y completar:

   ```powershell
   Copy-Item .env.e2e.example .env.e2e
   ```

   Descomentar y ajustar:

   ```text
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pancheria_e2e
   DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/pancheria_e2e
   ```

3. Levantar el servidor de E2E:

   ```powershell
   npm run dev:e2e
   ```

4. En otra terminal, ejecutar Playwright sin `webServer` (recomendado para depurar):

   ```powershell
   $env:NO_WEB_SERVER=1; npx playwright test
   ```

   O el comando integrado:

   ```powershell
   npm run test:e2e
   ```

5. Si hay fallos:
   - Revisar que `RATE_LIMIT_STORE_PROVIDER=memory`.
   - Revisar que `STORAGE_PROVIDER=local` y `LOCAL_STORAGE_PATH=tmp/e2e`.
   - Revisar que no haya una caja abierta residual en la base.
6. Documentar el resultado en `.devin/informes/reporte-estado.md`.

---

## 5. Revisión de archivos archivados

### Criterios

- **Conservar** si el archivo documenta decisiones arquitectónicas, riesgos o soluciones que puedan repetirse en el futuro.
- **Eliminar** si es un plan obsoleto que contiene instrucciones peligrosas, contradictorias o totalmente reemplazadas por documentación vigente.
- **No eliminar** reportes de estado históricos; son trazabilidad del proyecto.

### Estado actual

- Los índices de `.devin/prompts/README.md` y `.devin/informes/README.md` fueron depurados para eliminar referencias a archivos inexistentes.
- Se archivó `auditoria-rate-limit-429.md` tras confirmar que las correcciones (deshabilitar rate limit en desarrollo, mejorar `getClientIp` y documentar `PUBLIC_ORDER_RATE_LIMIT_ENABLE_IN_DEV`) ya están en `src/lib/rate-limit.ts`.
- Revisar periódicamente los reportes históricos en `.devin/informes/archivados/` y los prompts archivados en `.devin/prompts/archivados/` para decidir si conservan valor histórico.

> **Decisión pendiente:** confirmar con el responsable del proyecto antes de eliminar archivos archivados. La eliminación es reversible mediante git, pero debe ser intencional.

---

## 6. Checklist de sincronización de `.devin`

Antes de dar por terminada una tarea que modifique arquitectura, variables de entorno, flujos de negocio o dependencias:

- [ ] Actualizar `AGENTS.md` si cambian comandos, variables de entorno, convenciones o troubleshooting.
- [ ] Actualizar `.env.example` si aparece una nueva variable de entorno.
- [ ] Actualizar `.devin/environment.yaml` si cambian versiones, comandos de setup o conocimientos clave.
- [ ] Actualizar o archivar prompts en `.devin/prompts/` según correspondan; no dejar prompts resueltos como activos.
- [ ] Actualizar `.devin/informes/reporte-estado.md` o archivar el anterior si se genera uno nuevo.
- [ ] Actualizar índices (`.devin/README.md`, `.devin/prompts/README.md`, `.devin/informes/README.md`).
- [ ] Ejecutar `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` y `npm run knip`. Ejecutar `npm run test:e2e` solo si aplica y en base de prueba.
- [ ] No commitear `.env.local`, `.env.e2e` ni secretos.

El checklist también vive en `.devin/prompts/auditoria-y-documentacion.md`.

---

## 7. Falsos positivos del IDE en CI

- **Síntoma:** el IDE reporta `Unable to resolve action 'actions/checkout@v4'` y `actions/setup-node@v4` en `.github/workflows/ci.yml`.
- **Causa:** el validador del IDE no puede contactar la API de GitHub para resolver los tags de las acciones oficiales, ya sea por falta de red, autenticación o caché local.
- **Acción:** no modificar `.github/workflows/ci.yml`. Las acciones son oficiales, el tag `v4` es válido y el workflow funciona en GitHub Actions.
- **Si se quiere silenciar el IDE:** fijar las acciones a un SHA específico (por ejemplo, `actions/checkout@<sha>`), aceptando el costo de actualizar el SHA en cada release de seguridad.
- **Registrado en:** `.devin/informes/lecciones-aprendidas.md` sección 11.

---

## 8. Revisión de `knip.json`

- El informe anterior afirmaba que se eliminó la entrada `src/db/seeds.ts` de `knip.json`, pero el archivo `knip.json` aún la incluye.
- `package.json` no define un script para `src/db/seeds.ts` y `.github/workflows/ci.yml` tampoco lo referencia como punto de entrada.
- Si se decide eliminar la entrada, ejecutar `npm run knip` y confirmar que no aparecen `Configuration hints` ni reportes de archivo no usado.
- Registrado en: `.devin/informes/lecciones-aprendidas.md` sección 11.

---

## 9. Revisión de hardcodeos defensivos

- `src/lib/public-url.ts` tenía `http://localhost:3000` hardcodeado como fallback. Se refactorizó para:
  - Usar `NEXT_PUBLIC_APP_URL` (cliente y servidor) o `NEXTAUTH_URL` (servidor) como primeras opciones.
  - Usar `HOST` y `PORT` para el fallback de desarrollo/test antes de caer a `localhost:3000`.
  - Lanzar un error en producción si no hay URL base configurada, evitando URLs rotas en Vercel.
- `src/config/catalog.ts` tenía mensajes de WhatsApp hardcodeados. Se refactorizó para leer `NEXT_PUBLIC_WHATSAPP_MESSAGE_GREETING` y `NEXT_PUBLIC_WHATSAPP_MESSAGE_CLOSING` sin defaults.
- Los valores sugeridos pasaron a `.env.example` y `jest.setup.ts` provee `NEXTAUTH_URL=http://localhost:3000` para el entorno de tests.
- Decisión: el fallback final a `localhost:3000` sigue siendo un hardcodeo de desarrollo aceptable, pero `HOST`/`PORT` permiten configurarlo sin tocar código.

---

## 10. Verificaciones aplicadas en este plan

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 119 suites, 1102 tests pasan |
| `npm run build` | Build de producción exitoso (42 páginas dinámicas) |
| `npm run knip` | Pasa |

Una vez que se ejecuten los comandos pendientes (E2E y DRS), completar la tabla y archivar este plan en `.devin/informes/archivados/` o reemplazarlo por un `reporte-estado.md` actualizado.

---

## 11. Rotación de secretos (si `.env.local` se expuso)

> No modificar `.env.local` en el repositorio; este archivo no debe commitearse. Los pasos asumen que `.env.local` fue expuesto en logs, chat o cualquier medio no seguro.

1. **Generar un nuevo secreto de autenticación:**
   ```powershell
   npx auth secret
   # o
   openssl rand -base64 32
   ```
   Actualizar `NEXTAUTH_SECRET` (y opcionalmente `AUTH_SECRET`) en Vercel y en `.env.local`.
2. **Cambiar la contraseña de administrador:**
   - Generar una nueva contraseña segura.
   - Actualizar `ADMIN_PASSWORD` en Vercel y `.env.local`.
   - Ejecutar `npx tsx src/db/seeds.ts` contra la base correspondiente para hashear la nueva contraseña (solo en base de desarrollo/producción real; nunca en E2E).
3. **Rotar token de Vercel Blob:**
   - Desde el dashboard de Vercel, regenerar `BLOB_READ_WRITE_TOKEN`.
   - Actualizar la variable en Vercel y `.env.local`.
4. **Rotar credenciales de Neon:**
   - Desde el dashboard de Neon, cambiar la contraseña del usuario.
   - Actualizar `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_*` y `PG*` en Vercel y `.env.local`.
5. **Verificar que `.env.local` no esté en git:**
   ```powershell
   git check-ignore .env.local
   ```
   Debe devolver `.env.local`.

---

## 12. Plan de implementación de tests E2E

### Requisitos previos

- PostgreSQL local, Docker o una rama de Neon descartable cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`.
- Las variables de `ADMIN_USERNAME`/`ADMIN_PASSWORD` deben coincidir con el seed.

### Pasos

1. **Preparar la base de datos.** Ejemplo con Docker:
   ```powershell
   docker run --name pancheria-e2e -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pancheria_e2e -p 5432:5432 -d postgres:15
   ```
2. **Crear `.env.e2e` a partir del ejemplo:**
   ```powershell
   Copy-Item .env.e2e.example .env.e2e
   ```
   Completar como mínimo:
   ```text
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pancheria_e2e
   DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/pancheria_e2e
   NEXTAUTH_SECRET=<secreto de al menos 32 bytes>
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<contraseña>
   DEFAULT_BRANCH_NAME=Sucursal E2E
   ```
   Asegurarse de que `STORAGE_PROVIDER=local`, `LOCAL_STORAGE_PATH=tmp/e2e`, `RATE_LIMIT_STORE_PROVIDER=memory` y `PUBLIC_ORDER_RATE_LIMIT_STORE_PROVIDER=memory`.
3. **Opción A — ejecutar todo de una vez:**
   ```powershell
   npm run test:e2e
   ```
4. **Opción B — levantar manual y correr Playwright (mejor para depurar):**
   ```powershell
   npm run dev:e2e
   ```
   En otra terminal:
   ```powershell
   $env:NO_WEB_SERVER=1
   npx playwright test
   ```
5. **Validar que `global-setup.ts` truncó y re-seedea correctamente.** El log debe mostrar la creación de la sucursal y el catálogo.
6. **Documentar el resultado en `.devin/informes/reporte-estado.md` y cerrar este pendiente.**

> **Atención:** no ejecutar `npm run test:e2e` si `DATABASE_URL` apunta a producción o a una base con datos reales. `global-setup.ts` trunca todas las tablas de negocio.

---

## 13. Enlaces relevantes

- `.devin/informes/reporte-estado.md` — informe vigente.
- `.devin/informes/entornos.md` — entornos, credenciales y pasos de migración.
- `.devin/informes/lecciones-aprendidas.md` — lecciones transversales.
- `.devin/prompts/auditoria-y-documentacion.md` — checklist de sincronización y guía de auditoría.
- `.devin/environment.yaml` — blueprint de Devin.
- `AGENTS.md` — reglas, comandos y variables de entorno del proyecto.
