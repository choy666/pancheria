# Entornos y credenciales del proyecto

## Resumen rápido

| Entorno | ¿Dónde está la URL? | Variables obligatorias adicionales | Comando de migración | Comando para levantar / testear |
|---------|---------------------|------------------------------------|----------------------|---------------------------------|
| Desarrollo | `.env.local` → `DATABASE_URL_UNPOOLED` (o `POSTGRES_URL_NON_POOLING`) | `DATABASE_URL`, `NEXTAUTH_SECRET` o `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `npx drizzle-kit push` | `npm run dev` |
| Producción | Vercel → `DATABASE_URL_UNPOOLED` | `DATABASE_URL`, `AUTH_SECRET` o `NEXTAUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Ver [Producción](#producción) | `npm run build && npm run start` |
| E2E / Playwright | `.env.e2e` → `DATABASE_URL` | `DATABASE_URL`, `AUTH_SECRET` o `NEXTAUTH_SECRET`, `NEXTAUTH_URL`/`AUTH_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | No aplica (`global-setup.ts` maneja el esquema) | `npm run test:e2e` (asegurarse de que no haya otro servidor en `localhost:3000` usando `.env.local`) |

---

## Convención de archivos `.env`

| Archivo | Propósito | ¿Se commitea? |
|---------|-----------|---------------|
| `.env` | Variables por defecto para todos los entornos. | Sí, si no contiene secretos. |
| `.env.local` | Variables de desarrollo local. | **No**. Contiene `DATABASE_URL`, `NEXTAUTH_SECRET`, credenciales de admin, etc. |
| `.env.production` | Variables de producción fijas (sin secretos dinámicos). | Sí, si no contiene secretos. |
| `.env.production.local` | Descarga temporal de Vercel para operaciones puntuales. | **No**. Crear, usar y borrar inmediatamente. |
| `.env.e2e` | Variables para tests E2E. | **No**. Apunta a una base descartable. |

---

## Desarrollo

### Variables a definir

En `.env.local`:

- `DATABASE_URL` — URL del pooler de PostgreSQL (Neon) para la aplicación.
- `DATABASE_URL_UNPOOLED` — URL sin pooler para migraciones (`drizzle.config.ts`).
- Fallbacks: `POSTGRES_URL` y `POSTGRES_PRISMA_URL` para runtime; `POSTGRES_URL_NON_POOLING` para migraciones.
- `NEXTAUTH_SECRET` o `AUTH_SECRET` — secreto de autenticación de al menos 32 bytes.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credenciales del administrador inicial.

### Cómo encontrarlas

```powershell
Get-Content .env.local
```

Si no existe, copiar `.env.example` a `.env.local` y completar con los datos de la base de desarrollo.

### Aplicar migración en desarrollo

```powershell
npx drizzle-kit push
```

Si pide confirmación por `data-loss`, agregar `--force`:

```powershell
npx drizzle-kit push --force
```

---

## Producción

### 1. Obtener las variables de entorno

```powershell
npx vercel env pull .env.production.local --environment=production
```

Esto descarga **todos** los secretos de producción. Tratalo como un archivo sensible.

### 2. Identificar la URL de base de datos

La migración requiere `DATABASE_URL_UNPOOLED`. Buscala en el archivo descargado:

```powershell
Get-Content .env.production.local | Where-Object { $_ -match 'DATABASE_URL_UNPOOLED' }
```

### 3. Aplicar la migración

El archivo que genera Vercel envuelve los valores en comillas dobles y puede incluir saltos de línea. Se usa así:

```powershell
$env:DATABASE_URL_UNPOOLED = (
  Get-Content .env.production.local |
  Where-Object { $_ -match '^DATABASE_URL_UNPOOLED=' } |
  ForEach-Object { ($_ -split '=', 2)[1].Trim().Trim('"') }
)

npx drizzle-kit push --force
```

> **Por qué `.Trim().Trim('"')`**: el `env pull` de Vercel agrega `"` al inicio y al final de cada valor. Si no se quitan, `pg` no conecta.

### 4. Verificar que se aplicó

```powershell
$env:DATABASE_URL_UNPOOLED = (
  Get-Content .env.production.local |
  Where-Object { $_ -match '^DATABASE_URL_UNPOOLED=' } |
  ForEach-Object { ($_ -split '=', 2)[1].Trim().Trim('"') }
)

npx tsx -e "
import { Client } from 'pg';
const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED, ssl: { rejectUnauthorized: false } });
await client.connect();
const result = await client.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_phone'\");
console.log(result.rows.length > 0 ? 'OK: columna customer_phone aplicada.' : 'PENDIENTE: columna customer_phone no existe.');

const result2 = await client.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'opening_hours'\");
console.log(result2.rows.length > 0 ? 'OK: columna opening_hours aplicada.' : 'PENDIENTE: columna opening_hours no existe.');
await client.end();
"
```

### 5. Borrar el archivo inmediatamente

```powershell
Remove-Item .env.production.local
```

---

## E2E / Playwright

### Base de datos

- Usar una base **descartable** cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`.
- Configurar `DATABASE_URL` en `.env.e2e`.
- `tests/e2e/global-setup.ts` trunca las tablas de aplicación y re-ejecuta `src/db/seeds.ts` antes de cada run.
- **Nunca** ejecutar `npm run test:e2e` ni `npx drizzle-kit push` contra una base con datos reales.

### Variables obligatorias en `.env.e2e`

- `DATABASE_URL` — URL de la base descartable (puede usarse la misma del pooler de Neon o local).
- `DATABASE_URL_UNPOOLED` — URL sin pooler si se usan migraciones manuales en E2E (opcional; `drizzle.config.ts` hace fallback a `DATABASE_URL`).
- `AUTH_URL` y `NEXTAUTH_URL` — deben apuntar a `http://localhost:3000`.
- `BASE_URL` — URL base para Playwright (opcional; por defecto `http://localhost:3000`).
- `AUTH_SECRET` o `NEXTAUTH_SECRET` — secreto de al menos 32 bytes.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credenciales consistentes con `src/db/seeds.ts`.
- `DEFAULT_BRANCH_NAME` — nombre de la sucursal por defecto (opcional, el seed lo define).

### Cómo levantar y correr

```powershell
# Levantar servidor de pruebas
npm run dev:e2e

# En otra consola, correr Playwright
npm run test:e2e
```

También se puede levantar manualmente y correr con `NO_WEB_SERVER=1`:

```powershell
npm run dev:e2e
$env:NO_WEB_SERVER = 1
npx playwright test
```

Playwright lee `.env.local` primero y luego `.env.e2e` con prioridad, tanto en `playwright.config.ts` como en `scripts/dev-e2e.ts`.

> **Atención:** asegurate de que no haya otro proceso de Next.js en `localhost:3000` levantado con `.env.local` (por ejemplo `npm run dev` en otra consola). `playwright.config.ts` usa `reuseExistingServer: true`, por lo que un servidor previo con otra base puede hacer fallar el login de E2E.

### Cómo encontrar la URL de E2E

```powershell
Get-Content .env.e2e | Where-Object { $_ -match 'DATABASE_URL' }
```

---

## Cómo identificar a qué entorno apunta una URL

1. Ver el nombre de la base en la URL de Neon (`.../dbname?...`).
2. `main` o sin sufijo: probablemente producción.
3. `dev`, `develop`, `development`: desarrollo.
4. Termina en `test`, `e2e`, `testing`, `qa`, `staging`: descartable.
5. `localhost` o `127.0.0.1`: solo si hay PostgreSQL local corriendo.

Para confirmar, abrir una conexión directa con `pg` y consultar `current_database()`:

```powershell
$env:DATABASE_URL_UNPOOLED = (Get-Content .env.local | Where-Object { $_ -match '^DATABASE_URL_UNPOOLED=' } | ForEach-Object { ($_ -split '=', 2)[1].Trim().Trim('"') })
npx tsx -e "
import { Client } from 'pg';
const client = new Client({ connectionString: process.env.DATABASE_URL_UNPOOLED, ssl: { rejectUnauthorized: false } });
await client.connect();
const result = await client.query('SELECT current_database() AS db');
console.log('Base conectada:', result.rows[0].db);
await client.end();
"
```

---

## Semillas

```powershell
# Desarrollo
npx tsx src/db/seeds.ts

# E2E (el global-setup ya ejecuta el seed truncando tablas)
npm run test:e2e
```

---

## Seguridad

- Nunca hardcodear URLs de base de datos, secretos de autenticación ni credenciales en el código ni en prompts.
- No commitear `.env.local`, `.env.production.local` ni `.env.e2e`.
- Si se expone una credencial por accidente, rotarla inmediatamente en Neon/Vercel.
- El `npx vercel env pull` descarga secretos en texto plano. Usarlo solo cuando sea necesario y borrar el archivo al terminar.
- Ejecutar E2E solo en bases cuyo nombre termine en uno de los sufijos aceptados. El `global-setup.ts` aborta si no se cumple, salvo que se defina explícitamente `E2E_ALLOW_REMOTE_DB=true`.
