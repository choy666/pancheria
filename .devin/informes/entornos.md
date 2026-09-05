# Entornos y credenciales del proyecto

## Resumen rápido

| Entorno | ¿Dónde está la URL? | Variables obligatorias adicionales | Comando de migración | Comando para levantar / testear |
|---------|---------------------|------------------------------------|----------------------|---------------------------------|
| Desarrollo | `.env.local` → `DATABASE_URL_UNPOOLED` (o `POSTGRES_URL_NON_POOLING`) | `DATABASE_URL`, `NEXTAUTH_SECRET` o `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `npx drizzle-kit migrate` | `npm run dev` |
| Producción | Vercel → `DATABASE_URL_UNPOOLED` | `DATABASE_URL`, `AUTH_SECRET` o `NEXTAUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Ver [Producción](#producción) | `npm run build && npm run start` |
| E2E / Playwright | `.env.e2e` → `DATABASE_URL` | `DATABASE_URL`, `AUTH_SECRET` o `NEXTAUTH_SECRET`, `NEXTAUTH_URL`/`AUTH_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `npx drizzle-kit migrate` con las variables de `.env.e2e` (el `global-setup.ts` trunca y reseedea datos, pero no aplica el esquema) | `npm run test:e2e` (asegurarse de que no haya otro servidor en `localhost:3000` usando `.env.local`) |

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

La base de desarrollo tiene inicializado el historial `drizzle.__drizzle_migrations`, por lo que el flujo recomendado es:

```powershell
npx drizzle-kit generate   # genera la migración desde src/db/schema.ts
npx drizzle-kit migrate    # aplica las migraciones pendientes del journal
```

`npx drizzle-kit push` sigue disponible para sincronización directa, pero **no registra la migración en `drizzle.__drizzle_migrations`** y desalinea la base del historial commiteado. Si se usa `push`, generar igualmente la migración con `generate` y correr después:

```powershell
npx tsx scripts/drizzle-baseline.ts
```

para registrar el archivo como aplicado sin re-ejecutarlo.

> Nota: `push` pide confirmación interactiva (TTY) ante cambios destructivos o constraints sobre tablas con datos; en terminales sin TTY falla con "Interactive prompts require a TTY terminal". En ese caso usar `migrate` (que no es interactivo) o aplicar el SQL de la migración manualmente.

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
```

> **Por qué `.Trim().Trim('"')`**: el `env pull` de Vercel agrega `"` al inicio y al final de cada valor. Si no se quitan, `pg` no conecta.

#### Baseline de migraciones (ya realizado el 2026-09-05)

Producción tenía `drizzle.__drizzle_migrations` vacía y estaba atrasada hasta la migración `0024`. Se inicializó el baseline con `npx tsx scripts/drizzle-baseline.ts --through=0024` y luego `npx drizzle-kit migrate` aplicó `0025` (drop de `daily_closures`, tabla obsoleta tras el refactor del cierre diario), `0026` (campos `address`/`phone`/`location` de sucursales) y `0027` (`scope` en `public_order_rate_limits` y `order_id` en `stock_movements`). Las tres bases (desarrollo, E2E y producción) quedaron alineadas con el journal.

Si en el futuro otra base queda sin baseline, el procedimiento es:

```powershell
# Registra como aplicadas las migraciones ya presentes en la base
# (verificar primero con information_schema hasta qué migración llegó)
npx tsx scripts/drizzle-baseline.ts --through=<tag>

# Aplica solo las migraciones posteriores al baseline
npx drizzle-kit migrate
```

`migrate` no es interactivo y corre cada migración pendiente en una transacción, insertando su fila en `__drizzle_migrations`.

Alternativa vigente: `npx drizzle-kit push --force` sigue funcionando, pero no registra `__drizzle_migrations`; si se usa, correr después `npx tsx scripts/drizzle-baseline.ts` para registrar los archivos como aplicados.

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
const result = await client.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'order_id'\");
console.log(result.rows.length > 0 ? 'OK: stock_movements.order_id aplicada.' : 'PENDIENTE: stock_movements.order_id no existe.');

const result2 = await client.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'public_order_rate_limits' AND column_name = 'scope'\");
console.log(result2.rows.length > 0 ? 'OK: public_order_rate_limits.scope aplicada.' : 'PENDIENTE: public_order_rate_limits.scope no existe.');

const result3 = await client.query(\"SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations\");
console.log('Migraciones registradas en __drizzle_migrations:', result3.rows[0].n);
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
