# Notas para Agentes — Proyecto Panchería

## Idioma
Todas las explicaciones, comentarios y documentación deben estar en español.

## Seguridad
- No hardcodear credenciales, URLs de APIs ni parámetros sensibles en el código.
- Todos los valores sensibles deben provenir de variables de entorno o configuraciones dinámicas.

## Comandos principales

| Propósito                | Comando                                           |
| ------------------------ | ------------------------------------------------- |
| Instalar dependencias    | `npm install`                                     |
| Ejecutar en desarrollo   | `npm run dev`                                     |
| Compilar                 | `npm run build`                                   |
| Lint                     | `npm run lint`                                    |
| Tests unitarios          | `npm test`                                        |
| Tests E2E                | `npx playwright test`                             |

> **Atención:** `tests/e2e/global-setup.ts` trunca las tablas `products`, `recipes`, `sales`, `sale_items`, `stock_movements`, `cash_registers` y `daily_closures`, y re-ejecuta `src/db/seeds.ts`. No correr los tests E2E en una base de datos con datos reales.
| Generar migraciones      | `npx drizzle-kit generate`                        |
| Empujar migraciones      | `npx drizzle-kit push`                            |
| Ejecutar seed            | `npx tsx src/db/seeds.ts`                         |

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar:

- `DATABASE_URL` — URL de conexión a PostgreSQL (Neon). En Vercel Postgres equivale a `POSTGRES_URL` (pooled).
- `DATABASE_URL_UNPOOLED` — URL sin pooler para `drizzle-kit` (migraciones). En Vercel Postgres equivale a `POSTGRES_URL_NON_POOLING`.
- `NEXTAUTH_URL` — URL base de la app, por defecto `http://localhost:3000`.
- `NEXTAUTH_SECRET` — secreto para sesiones de NextAuth.
- `ADMIN_USERNAME` — usuario administrador único.
- `ADMIN_PASSWORD` — contraseña en texto plano; el seed la hashea con bcrypt.
- `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` — intervalo de refresco del panel de caja en milisegundos (por defecto 5000 ms).

> **Importante:** para que el comportamiento sea idéntico en desarrollo y producción, `DATABASE_URL` debe apuntar a la misma base de datos (o a una réplica/branch de Neon) en ambos entornos. No dejar `DATABASE_URL` apuntando a `localhost` si no hay un PostgreSQL local corriendo; en ese caso usá el mismo URL de Neon que en Vercel.

## Configuración del blueprint de Devin
- El blueprint para el snapshot de Devin vive en `.devin/environment.yaml`.
- Para subirlo a Devin Cloud se requiere autenticación con `devin.exe auth login` y un repositorio en GitHub.
- El flujo de DRS es:
  1. `devin.exe cloud drs blueprint-create --repo <owner/repo> --from-file .devin/environment.yaml`
  2. `devin.exe cloud drs build`

## Tecnologías
- Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Drizzle ORM, PostgreSQL, NextAuth v5.

## Despliegue en Vercel

### Opción A — deploy manual con Vercel CLI (recomendado para aprender)

1. Asegurate de tener `.env.local` completo con `DATABASE_URL`, `NEXTAUTH_SECRET`, `ADMIN_USERNAME` y `ADMIN_PASSWORD`.
2. Login en Vercel CLI:
   ```bash
   vercel login
   ```
3. Si el proyecto ya existe y tiene Framework Preset incorrecto o Deployment Protection activado, eliminarlo y recrearlo:
   ```bash
   vercel project remove <nombre-proyecto>
   Remove-Item -Path .vercel/project.json, .vercel/README.txt -Force
   vercel --prod --yes
   ```
   - El CLI detectará Next.js automáticamente y conectará el repositorio de GitHub si existe.
   - Anotá el dominio de producción asignado (por ejemplo `https://pancheria-alpha.vercel.app`).
4. Subir las variables de entorno a Vercel:
   ```bash
   $db = (Get-Content .env.local | Select-String '^DATABASE_URL=(.*)').Matches.Groups[1].Value; $db | vercel env add DATABASE_URL production
   $secret = (Get-Content .env.local | Select-String '^NEXTAUTH_SECRET=(.*)').Matches.Groups[1].Value; $secret | vercel env add NEXTAUTH_SECRET production
   $user = (Get-Content .env.local | Select-String '^ADMIN_USERNAME=(.*)').Matches.Groups[1].Value; $user | vercel env add ADMIN_USERNAME production
   $pass = (Get-Content .env.local | Select-String '^ADMIN_PASSWORD=(.*)').Matches.Groups[1].Value; $pass | vercel env add ADMIN_PASSWORD production
   echo "https://<dominio-produccion>.vercel.app" | vercel env add NEXTAUTH_URL production
   ```
5. Sincronizar la base de datos de producción:
   ```bash
   npx drizzle-kit push
   npx tsx src/db/seeds.ts
   ```
6. Redeployar para que las variables de entorno formen parte del build:
   ```bash
   vercel --prod --yes
   ```

### Notas importantes para futuros proyectos Next.js en Vercel

- Siempre verificar en `vercel inspect <url>` que `Builds` contenga funciones serverless (`λ`); si aparece `Framework Preset: Other`, el proyecto no detectó Next.js y no servirá las rutas del App Router. En ese caso, recrear el proyecto como se indica arriba.
- Si la URL muestra la pantalla de login de Vercel en lugar de la app, es porque **Vercel Authentication** (Deployment Protection) está activado. Deshabilitarlo desde el dashboard: **Settings → Deployment Protection → Vercel Authentication**.
- `NEXTAUTH_URL` debe coincidir con el dominio de producción asignado por Vercel (el alias del deployment, no la URL única generada).
- Con GitHub conectado, cualquier `push` a `main` genera un deploy automático y lo asigna al dominio de producción.

### Opción B — deploy automático desde GitHub
1. Conectar el repositorio de GitHub en el dashboard de Vercel.
2. Configurar las variables de entorno en Vercel.
3. Ejecutar `npx drizzle-kit push` y `npx tsx src/db/seeds.ts` en producción.
4. Hacer push a `main` para que Vercel haga el deploy automático.

## Troubleshooting

### `ECONNREFUSED` al conectar con PostgreSQL en desarrollo

- Verificar que `DATABASE_URL` en `.env.local` no apunte a `localhost` si no hay un PostgreSQL local corriendo.
- Preferir usar la misma URL de Neon que en Vercel (`POSTGRES_URL`) para que dev y prod se comporten igual.
- Revisar `src/db/index.ts` para entender el orden de resolución: `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`.
- Para migraciones, `drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` → `POSTGRES_URL`.
