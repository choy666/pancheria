# Auditoría del Deploy de Vercel — 2026-09-14

## Resumen Ejecutivo

Se realizó una auditoría completa del deploy de Vercel del proyecto Panchería. La configuración general es sólida y sigue buenas prácticas de seguridad y gestión de secretos. Se identificaron algunos puntos de mejora para optimizar la consistencia entre entornos y la seguridad del deployment.

## Hallazgos

### ✅ Aspectos Positivos

1. **Gestión de Variables de Entorno**
   - Todas las variables sensibles se leen dinámicamente desde variables de entorno
   - No hay credenciales hardcodeadas en el código
   - Documentación completa en `.env.example` y `AGENTS.md`
   - Uso correcto de fallbacks (`DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`)

2. **Configuración de Build**
   - `next.config.ts` bien configurado con headers de seguridad
   - Bundle analyzer integrado para optimización
   - Configuración de imágenes dinámica según proveedor de almacenamiento
   - Content-Security-Policy con nonce por request

3. **Workflows de CI/CD**
   - Pipeline de CI completo: lint, typecheck, tests unitarios, build, knip, E2E
   - Separación clara entre entornos de desarrollo, E2E y producción
   - Protección de secretos en GitHub Actions
   - Variables críticas validadas antes de ejecutar workflows

4. **Migraciones de Base de Datos**
   - Flujo de migraciones bien documentado en `entornos.md`
   - Uso de `drizzle-kit` con baseline para producción
   - Separación entre URLs con pooler (runtime) y sin pooler (migraciones)

5. **Almacenamiento y Archivos**
   - Configuración flexible de proveedores: `local`, `vercel-blob`, `s3`, `r2`
   - Validación de tipos MIME mediante magic bytes
   - Limpieza automática de archivos huérfanos mediante cron jobs
   - Advertencias correctas sobre filesystem efímero de Vercel

### ⚠️ Puntos de Atención

1. **Dependencia de `VERCEL_PRODUCTION_URL`**
   - El workflow `expire-orders.yml` requiere la variable de repositorio `VERCEL_PRODUCTION_URL`
   - Si esta variable no está configurada, el workflow falla
   - **Riesgo**: Si se cambia el dominio de producción y no se actualiza esta variable, el cron fallará
   - **Recomendación**: Documentar este requisito claramente en el README y checklist pre-push

2. **Configuración de Analytics** — ✅ Resuelto (2026-09-15)
   - Vercel Analytics está condicionado a `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true`
   - Requiere activación manual en el dashboard de Vercel
   - ~~No hay validación automática de que el script se carga correctamente~~ → `ConditionalAnalytics` ahora registra `logger.warn` en `onerror` del script

3. **Storage Provider en Producción** — ✅ Resuelto (2026-09-15)
   - ~~No hay validación automática de que `STORAGE_PROVIDER` no sea `local` en producción~~ → `next.config.ts` falla el build de producción en Vercel (`VERCEL_ENV=production` + `CI`) si `STORAGE_PROVIDER=local`
   - El warning en `getStorageProvider()` se mantiene como defensa en runtime
   - **Riesgo**: mitigado — un deploy con `local` ya no compila

4. **Sincronización de URLs** — ✅ Resuelto (2026-09-15)
   - Las URLs públicas dependen de `NEXT_PUBLIC_APP_URL` → `NEXTAUTH_URL` → `AUTH_URL`
   - ~~Si estas variables no están configuradas correctamente en producción, las URLs de videos/adjuntos apuntarán a `localhost:3000`~~ → el build de producción en Vercel falla si falta `NEXTAUTH_URL`/`AUTH_URL`

5. **Consistencia de Variables entre Entornos** — ✅ Resuelto (2026-09-15)
   - Algunas variables tienen diferentes valores por defecto según el entorno
   - `RATE_LIMIT_STORE_PROVIDER` cambia automáticamente entre `memory` (dev) y `db` (prod)
   - ~~**Recomendación**: Documentar explícitamente estas diferencias en AGENTS.md~~ → sección "Variables con comportamiento distinto por entorno" agregada en `AGENTS.md`

### 🔴 Problemas Identificados

1. **Error Reciente: Migración No Aplicada**
   - **Problema**: La migración `0030_branch_contacts.sql` no se había aplicado en la base de datos local
   - **Causa**: La migración cambia la columna `phone` (singular) a `phones` (plural) pero no se ejecutó
   - **Impacto**: El servidor fallaba con error `column "phones" does not exist`
   - **Solución**: Ejecutar `npx drizzle-kit migrate` para aplicar migraciones pendientes
   - **Estado**: ✅ Resuelto

2. **Falta de Validación Build-Time para Secretos Críticos** — ✅ Resuelto (2026-09-15)
   - **Problema**: No hay validación de que `CRON_SECRET` esté configurado en build time
   - **Impacto**: Los endpoints de cron fallarán silenciosamente en producción si falta el secreto
   - **Solución**: `next.config.ts` valida en build time (`VERCEL_ENV=production` + `CI`, es decir, solo en builds reales de Vercel) `CRON_SECRET`, `NEXTAUTH_URL`/`AUTH_URL`, `NEXTAUTH_SECRET`/`AUTH_SECRET`, URL de base de datos y `STORAGE_PROVIDER≠local`

## Recomendaciones

### Inmediatas (Alta Prioridad)

1. **Agregar Validación de Variables Críticas en Build**
   ```typescript
   // next.config.ts
   if (process.env.NODE_ENV === 'production') {
     if (!process.env.CRON_SECRET) {
       throw new Error('CRON_SECRET es obligatorio en producción');
     }
     if (!process.env.NEXTAUTH_URL && !process.env.AUTH_URL) {
       throw new Error('NEXTAUTH_URL o AUTH_URL es obligatorio en producción');
     }
   }
   ```

2. **Actualizar Checklist Pre-Push**
   - Agregar verificación de `VERCEL_PRODUCTION_URL` en GitHub Actions
   - Documentar claramente los requisitos del workflow `expire-orders.yml`

3. **Validación de Storage Provider en Producción**
   - Considerar hacer el warning de `STORAGE_PROVIDER=local` en producción más estricto
   - Posible lanzar error en build time si es `local` en producción

### Mediano Plazo (Prioridad Media)

1. **Mejorar Monitoreo de Analytics**
   - Agregar validación de que el script de Vercel Analytics se carga correctamente
   - Considerar eventos de error personalizados para debugging

2. **Documentación de Diferencias entre Entornos**
   - Crear sección específica en AGENTS.md sobre variables con comportamiento diferente según entorno
   - Incluir ejemplos de configuración para cada entorno

3. **Testing de Variables de Entorno**
   - Agregar tests unitarios para getters de configuración críticos
   - Validar que las fallbacks funcionen correctamente

### Largo Plazo (Prioridad Baja)

1. **Automatización de Verificación de Configuración**
   - Script pre-commit que valide variables críticas en `.env.local`
   - Integración con Vercel CLI para validar configuración antes de deploy

2. **Dashboard de Estado de Configuración**
   - Endpoint interno que exponga el estado de variables críticas (sin valores)
   - Ayuda a identificar rápidamente problemas de configuración

## Estado del Deploy

### Variables Críticas Requeridas en Vercel (Producción)

- ✅ `DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_PRISMA_URL`
- ✅ `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`
- ✅ `AUTH_URL` / `NEXTAUTH_URL`
- ✅ `AUTH_SECRET` / `NEXTAUTH_SECRET`
- ✅ `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- ✅ `CRON_SECRET`
- ⚠️ `VERCEL_PRODUCTION_URL` (variable de repositorio en GitHub Actions)

### Variables de Almacenamiento (Según Proveedor)

- **Si `STORAGE_PROVIDER=vercel-blob`**:
  - ✅ `BLOB_READ_WRITE_TOKEN`

- **Si `STORAGE_PROVIDER=s3`**:
  - ✅ `S3_ACCESS_KEY_ID`
  - ✅ `S3_SECRET_ACCESS_KEY`
  - ✅ `S3_BUCKET`
  - ✅ `S3_REGION`
  - ✅ `S3_ENDPOINT` (opcional)

- **Si `STORAGE_PROVIDER=r2`**:
  - ✅ `R2_ACCOUNT_ID`
  - ✅ `R2_ACCESS_KEY_ID`
  - ✅ `R2_SECRET_ACCESS_KEY`
  - ✅ `R2_BUCKET_NAME`
  - ✅ `R2_REGION`

### Variables Opcionales Recomendadas

- `NEXT_PUBLIC_APP_URL` — para URLs públicas consistentes
- `STORAGE_PROVIDER` — por defecto `local`, cambiar en producción
- `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` — para habilitar analytics
- `TRUSTED_PROXY_IP_HEADER` — para rate limiting en producción
- `RATE_LIMIT_STORE_PROVIDER` — para intentos fallidos de login

## Conclusión

El deploy de Vercel está bien configurado con buenas prácticas de seguridad y gestión de secretos. Los principales puntos de mejora son:

1. Agregar validaciones build-time para variables críticas
2. Mejorar documentación de dependencias entre sistemas (Vercel ↔ GitHub Actions)
3. Considerar validaciones más estrictas para configuraciones de riesgo (ej: `STORAGE_PROVIDER=local` en producción)

El problema reciente con la migración no aplicada fue resuelto correctamente aplicando `npx drizzle-kit migrate`. Para evitar futuros problemas, se recomienda agregar verificación de migraciones pendientes en el pipeline de CI.

---

**Fecha de auditoría**: 2026-09-14  
**Realizado por**: Devin (agente de codificación)  
**Estado**: ✅ Generalmente saludable con mejoras recomendadas