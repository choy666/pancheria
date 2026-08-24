# Plan de acción — Cierre de pendientes post-auditoría `.devin`

**Fecha:** 2026-08-24  
**Proyecto:** `pancheria`

---

## 1. Resumen ejecutivo

Este plan detalla las acciones necesarias para resolver las recomendaciones de `.devin/informes/reporte-estado.md` y otras deudas documentales/configuración detectadas. Se divide en:

- **Acciones ya aplicadas:** limpieza de `knip.json`, documentación de falsos positivos de CI y checklist de sincronización.
- **Acciones que requieren autenticación externa:** verificación del blueprint de Devin (`devin.exe auth login`).
- **Acciones que requieren base de datos de prueba:** ejecución completa de `npm run test:e2e`.
- **Acciones de mantenimiento continuo:** revisión de archivados y sincronización de `.devin` con cada cambio arquitectónico.

El objetivo es dejar los pendientes con un dueño, un criterio de salida y una verificación reproducible.

---

## 2. Estado de los pendientes

| # | Pendiente | Estado | Riesgo | Bloqueante | Acción inmediata | Verificación |
|---|---|---|---|---|---|---|
| 1 | Verificar blueprint de Devin | Pendiente | Medio | Requiere `devin.exe auth login` y acceso al repositorio en GitHub | Ejecutar `devin.exe cloud drs blueprint-create` y `devin.exe cloud drs build`; corregir `.devin/environment.yaml` si falla. | `devin.exe cloud drs build` finaliza exitosamente. |
| 2 | Correr E2E en base de prueba | Pendiente | Alto (datos) | Requiere base descartable y `.env.e2e` configurado | Crear base local/rama de Neon, completar `.env.e2e` y ejecutar `npm run test:e2e`. | Suite completa pasa sin errores y sin afectar datos reales. |
| 3 | Revisar archivados | En revisión | Bajo | Decisión sobre valor histórico | Aplicar criterios del plan; proponer eliminación de archivos obsoletos/peligrosos. | Índices actualizados y archivos redundantes removidos con confirmación. |
| 4 | Mantener `.devin` sincronizado | En curso | Medio | Disciplina del equipo | Usar el checklist de sincronización en `.devin/prompts/auditoria-y-documentacion.md` y `.devin/informes/lecciones-aprendidas.md`. | Cada cambio arquitectónico incluye documentación. |
| 5 | Falsos positivos de CI | Documentado | Bajo | Validación del IDE | No modificar `.github/workflows/ci.yml`; documentar causas y opción de pin a SHA. | `npm run lint` pasa; workflow sin cambios innecesarios. |
| 6 | Sugerencia de `knip` | Resuelto | Bajo | Ninguno | Eliminar `src/db/seeds.ts` de `knip.json`; Knip ya lo detecta desde `.github/workflows/ci.yml`. | `npm run knip` pasa sin `Configuration hints`. |

---

## 3. Verificar blueprint de Devin (DRS)

### Requisitos

- `devin.exe auth login` configurado en la máquina local.
- Acceso al repositorio en GitHub (sustituir `<owner/repo>` por el valor real, por ejemplo `choy666/pancheria`).
- Archivo `.devin/environment.yaml` vigente.

### Pasos

1. `devin.exe auth login`
2. `devin.exe cloud drs blueprint-create --repo <owner/repo> --from-file .devin/environment.yaml`
3. `devin.exe cloud drs build`
4. Si el build falla por dependencias, variables de entorno o comandos:
   - Corregir `.devin/environment.yaml` sin hardcodear secretos.
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

### Propuesta inmediata

Revisar `.devin/informes/archivados/plan-implementacion-chat-2026-08-23.md`. Aunque su encabezado indica `resuelto / obsoleto`, las fases 0.2 y 0.3 sugieren:

- Hacer un commit de respaldo del flujo de chat.
- Correr `npx drizzle-kit push` y `npx tsx src/db/seeds.ts` contra la base de desarrollo.

La documentación vigente (`AGENTS.md` y `.devin/informes/reporte-estado.md`) ya cubre el flujo con criterios más seguros (base descartable, `.env.e2e`, confirmación explícita). Este archivo puede eliminarse para evitar que futuros agentes lo sigan por error.

> **Decisión pendiente:** confirmar con el responsable del proyecto antes de eliminar archivos archivados. La eliminación propuesta es reversible mediante git, pero debe ser intencional.

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

## 8. Resolución de `knip`

- Se eliminó la entrada `src/db/seeds.ts` de `knip.json`. <ref_file file="C:/developer/paginas/pancheria/knip.json" />
- Knip ya detecta `src/db/seeds.ts` como punto de entrada desde el workflow de CI: <ref_snippet file="C:/developer/paginas/pancheria/.github/workflows/ci.yml" lines="117-118" />
- Resultado: `npm run knip` pasa sin `Configuration hints`.
- Registrado en: `.devin/informes/lecciones-aprendidas.md` sección 11.

---

## 9. Verificaciones aplicadas en este plan

| Comando | Resultado |
|---|---|
| `npm run lint` | Pasa |
| `npx tsc --noEmit` | Pasa |
| `npm test` | 92 suites, 890 tests pasan |
| `npm run build` | Build de producción exitoso (43 páginas) |
| `npm run knip` | Pasa sin configuration hints |

Una vez que se ejecuten los comandos pendientes, completar la tabla y archivar este plan en `.devin/informes/archivados/` o reemplazarlo por un `reporte-estado.md` actualizado.

---

## 10. Enlaces relevantes

- `.devin/informes/reporte-estado.md` — informe vigente.
- `.devin/informes/lecciones-aprendidas.md` — lecciones transversales.
- `.devin/prompts/auditoria-y-documentacion.md` — checklist de sincronización y guía de auditoría.
- `.devin/environment.yaml` — blueprint de Devin.
- `AGENTS.md` — reglas, comandos y variables de entorno del proyecto.
