# Prompt: Auditar deploy con `DEPLOYMENT_NOT_FOUND` en `pancheria-five.vercel.app`

## Contexto

Proyecto: `pancheria` — Sistema de gestión de stock, ventas, productos, recetas, caja, cierre diario, multi-sucursal, catálogo público de pedidos y gestión de videos.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM 0.45.2 con PostgreSQL (Neon), NextAuth v5.

Documentación de referencia obligatoria:
- <ref_file file="C:/developer/paginas/pancheria/AGENTS.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/auditoria-y-documentacion.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/prompts/pancheria.prompt.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/lecciones-aprendidas.md" />
- <ref_file file="C:/developer/paginas/pancheria/.devin/informes/reporte-estado.md" />

## Estado actual relevante

- Existe un deploy productivo funcional en `https://pancheria-alpha.vercel.app`, que responde `307 Temporary Redirect` a `/pedido` y setea `authjs.callback-url=https%3A%2F%2Fpancheria-alpha.vercel.app`.
- Otro enlace, `https://pancheria-five.vercel.app`, devuelve `404: NOT_FOUND` con `X-Vercel-Error: DEPLOYMENT_NOT_FOUND`.
- En el repositorio local, `.vercel/project.json` apunta a `projectName: pancheria`.
- No hay referencias en el código ni en la documentación que vinculen el dominio `pancheria-five` con el proyecto actual.

## Objetivo

Determinar por qué `pancheria-five.vercel.app` devuelve `DEPLOYMENT_NOT_FOUND` mientras `pancheria-alpha.vercel.app` funciona, auditar la configuración de deploy del proyecto y documentar los pasos correctos para consolidar el dominio productivo, eliminar URLs rotas y evitar confusiones futuras.

## Áreas de auditoría

1. **Relación entre dominios y proyecto en Vercel**
   - Verificar en el dashboard de Vercel si `pancheria-five` alguna vez fue dominio, alias de deployment o nombre de proyecto vinculado a `pancheria`.
   - Confirmar cuál es el dominio de producción asignado actualmente (`pancheria-alpha` u otro).
   - Revisar si `pancheria-five` corresponde a un proyecto eliminado, renombrado o a un deploy caducado.

2. **Configuración local de Vercel CLI**
   - Revisar `.vercel/project.json` y comparar `projectId` / `projectName` con el proyecto que aparece en el dashboard.
   - Confirmar que `pancheria-five` no esté registrado en otro directorio local o en otro `project.json`.

3. **Variables de entorno y `NEXTAUTH_URL` / `AUTH_URL`**
   - Verificar que `NEXTAUTH_URL` (o `AUTH_URL` si existe) apunte al dominio productivo real.
   - Confirmar que no haya duplicidad ni URLs apuntando a `localhost` en el entorno de producción de Vercel.
   - Revisar `.env.local` local solo para confirmar que no se comitee; no exponer sus valores.

4. **Builds y Framework Preset**
   - Ejecutar `vercel inspect <url>` para ambos dominios.
   - Verificar que el build productivo contenga funciones serverless (`λ`) y que el Framework Preset sea Next.js.
   - Si figura `Framework Preset: Other`, seguir el procedimiento de recreación del proyecto descrito en `AGENTS.md`.

5. **Deploy automático desde GitHub vs. manual**
   - Revisar en el dashboard si el proyecto está conectado a GitHub y si `main` dispara deploys automáticos.
   - Confirmar que el dominio asignado por Vercel (`pancheria-alpha`) coincide con el que se usa en documentos, README y `.env.example`.

6. **Deployment Protection / Vercel Authentication**
   - Confirmar si `pancheria-five` redirigía previamente a una pantalla de login de Vercel (indicaría Deployment Protection activado) o directamente a `DEPLOYMENT_NOT_FOUND`.

7. **DNS y dominios personalizados**
   - Verificar si `pancheria-five` era un dominio personalizado o un subdominio de `vercel.app` asignado por Vercel.
   - Revisar si hay registros CNAME/A antiguos que apunten a un deploy inexistente.

## Reglas de trabajo

1. No hardcodear credenciales, URLs de APIs, `projectId` ni secretos en ningún informe, prompt o código.
2. No exponer `.env.local`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `NEXTAUTH_SECRET` ni URLs de base de datos.
3. No ejecutar `npx tsx src/db/seeds.ts`, `npx drizzle-kit push`, `npx drizzle-kit generate` ni `npm run test:e2e` sin confirmación explícita del usuario.
4. Documentar en español todos los hallazgos.
5. Clasificar hallazgos en **crítico**, **mayor**, **menor** o **informativo**.

## Implementación detallada / Pasos de auditoría

### Paso 1: reconocimiento del estado de cada dominio
Ejecutar:
```bash
curl -I https://pancheria-five.vercel.app
curl -I https://pancheria-alpha.vercel.app
```
Registrar:
- Código de respuesta.
- Headers `X-Vercel-Error`, `X-Vercel-Id`, `Location`.
- Presencia de cookies de NextAuth (`authjs.callback-url`).

### Paso 2: inspección con Vercel CLI
Requiere autenticación previa (`vercel login`):
```bash
vercel inspect https://pancheria-five.vercel.app
vercel inspect https://pancheria-alpha.vercel.app
vercel project ls
vercel domains ls
```
Registrar el `projectName`, `projectId`, `orgId`, dominios asignados y alias de producción.

### Paso 3: revisión de configuración local
Leer:
- <ref_file file="C:/developer/paginas/pancheria/.vercel/project.json" />
- <ref_file file="C:/developer/paginas/pancheria/vercel.json" />
- <ref_file file="C:/developer/paginas/pancheria/next.config.ts" />
- <ref_file file="C:/developer/paginas/pancheria/package.json" />

Confirmar que el `projectName` local coincida con el proyecto activo en Vercel.

### Paso 4: revisión de variables de entorno en Vercel
Desde el dashboard o con CLI:
```bash
vercel env ls
```
Verificar:
- `NEXTAUTH_URL` / `AUTH_URL` coinciden con el dominio productivo.
- No hay variables apuntando a `localhost` en producción.
- `DATABASE_URL` y credenciales de almacenamiento son correctas.

### Paso 5: revisión de builds y Framework Preset
En el dashboard de Vercel, para el dominio productivo:
- Verificar que `Builds` contenga funciones serverless (`λ`).
- Si aparece `Framework Preset: Other`, seguir la recreación del proyecto indicada en `AGENTS.md`.

### Paso 6: análisis de causa probable de `DEPLOYMENT_NOT_FOUND`

Posibles causas a documentar:
1. `pancheria-five` es un deployment antiguo que fue eliminado o expiró.
2. `pancheria-five` pertenecía a otro proyecto Vercel (por ejemplo, `pancheria` renombrado) y ya no existe.
3. `pancheria-five` es un dominio personalizado que apunta a un `deployment URL` inexistente.
4. El proyecto fue recreado y Vercel asignó un nuevo dominio (`pancheria-alpha`), dejando `pancheria-five` huérfano.
5. El deploy fue movido a otro equipo / cuenta y ya no es accesible desde la cuenta actual.

### Paso 7: decisión y acciones correctivas
Definir junto con el usuario:
- Si `pancheria-five` debe redirigir a `pancheria-alpha` (dominio personalizado con redirect).
- Si debe eliminarse de registros DNS, documentación y bookmarks.
- Si `pancheria-alpha` debe seguir siendo el dominio productivo oficial.
- Si es necesario recrear el proyecto en Vercel por `Framework Preset: Other` o desconfiguración.

## Consideraciones de seguridad y entorno

- No compartir `projectId`, `orgId`, tokens de Vercel, credenciales de base de datos ni secretos de NextAuth en la documentación.
- Si se recrea el proyecto, volver a subir las variables de entorno con `vercel env add` y nunca commitear `.env.local`.
- Si `pancheria-five` era un dominio personalizado, asegurar que la renovación o transferencia de DNS no exponga el sitio a takeovers.
- No ejecutar `vercel project remove` sin confirmación explícita y sin respaldar variables de entorno.

## Verificaciones antes de declarar terminada la auditoría

| Paso | Comando / Acción | Propósito |
| ---- | ---------------- | --------- |
| 1 | `curl -I https://pancheria-five.vercel.app` y `curl -I https://pancheria-alpha.vercel.app` | Confirmar estado HTTP de cada dominio |
| 2 | `vercel inspect https://pancheria-alpha.vercel.app` | Validar build, funciones serverless y Framework Preset |
| 3 | `vercel project ls` y `vercel domains ls` | Mapear proyectos y dominios de la cuenta |
| 4 | `vercel env ls` | Verificar variables de entorno en producción |
| 5 | `npm run build` local | Validar que el proyecto compila correctamente |
| 6 | Revisar DNS del dominio personalizado (si aplica) | Confirmar que `pancheria-five` no apunte a un deploy inexistente |

## Entregables

1. Informe en `.devin/informes/reporte-estado.md` con:
   - Resumen ejecutivo.
   - Causa probable de `DEPLOYMENT_NOT_FOUND` en `pancheria-five`.
   - Comparativa entre `pancheria-five` y `pancheria-alpha`.
   - Estado de variables de entorno y Framework Preset.
   - Recomendaciones y acciones correctivas acordadas.
2. Actualización de `AGENTS.md` o `.env.example` solo si se detecta una omisión documental respaldada por evidencia.
3. Prompt final guardado en `.devin/prompts/` (si se decide archivarlo).
