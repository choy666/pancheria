# Entornos y credenciales del proyecto

## Resumen rápido

| Entorno | ¿Dónde está la URL? | Comando de migración |
|---------|---------------------|----------------------|
| Desarrollo | `.env.local` → `DATABASE_URL_UNPOOLED` | `npx drizzle-kit push` |
| Producción | Vercel → `DATABASE_URL_UNPOOLED` | Ver sección [Producción](#producción) |
| E2E / staging | `.env.e2e` → `DATABASE_URL` | `npm run dev:e2e` y `npm run test:e2e` |

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

- Local: `DATABASE_URL` y `DATABASE_URL_UNPOOLED` en `.env.local`.
- Suelen apuntar a un branch o base de desarrollo de **Neon**.
- `drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` (sin pooler) para migraciones.

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

### 2. Aplicar la migración

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

### 3. Verificar que se aplicó

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

const result2 = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'opening_hours'");
console.log(result2.rows.length > 0 ? 'OK: columna opening_hours aplicada.' : 'PENDIENTE: columna opening_hours no existe.');
await client.end();
"
```

### 4. Borrar el archivo inmediatamente

```powershell
Remove-Item .env.production.local
```

---

## Cómo identificar a qué entorno apunta una URL

1. Ver el nombre de la base en la URL de Neon (`.../dbname?...`).
2. `main` o sin sufijo: probablemente producción.
3. `dev`, `develop`, `development`: desarrollo.
4. Termina en `test`, `e2e`, `testing`, `qa`, `staging`: descartable.
5. `localhost` o `127.0.0.1`: solo si hay PostgreSQL local corriendo.

---

## E2E / staging

- Base aparte cuyo nombre termine en `test`, `e2e`, `testing`, `qa` o `staging`.
- Configurar en `.env.e2e` y usar `npm run dev:e2e`.
- `tests/e2e/global-setup.ts` trunca tablas y ejecuta `src/db/seeds.ts` al inicio.
- **Nunca** ejecutar `npm run test:e2e` ni `npx drizzle-kit push` contra una base con datos reales.

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
