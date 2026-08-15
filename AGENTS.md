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
| Iniciar en producción    | `npm run start`                                   |
| Analizar bundle          | `npm run analyze`                                 |
| Lint                     | `npm run lint`                                    |
| Tests unitarios          | `npm test`                                        |
| Verificación de tipos    | `npx tsc --noEmit`                                |
| Tests E2E                | `npm run test:e2e`                                |
| Generar migraciones      | `npx drizzle-kit generate`                        |
| Empujar migraciones      | `npx drizzle-kit push`                            |
| Ejecutar seed            | `npx tsx src/db/seeds.ts`                         |

> **Atención:** `tests/e2e/global-setup.ts` trunca las tablas `products`, `recipes`, `sales`, `sale_items`, `stock_movements`, `cash_registers` y `daily_closures`, y re-ejecuta `src/db/seeds.ts`. No correr los tests E2E en una base de datos con datos reales.

## Variables de entorno
Copiar `.env.example` a `.env.local` y completar:

- `DATABASE_URL` — URL de conexión a PostgreSQL (Neon). En Vercel Postgres equivale a `POSTGRES_URL` (pooled).
- `DATABASE_URL_UNPOOLED` — URL sin pooler para `drizzle-kit` (migraciones). En Vercel Postgres equivale a `POSTGRES_URL_NON_POOLING`.
- `NEXTAUTH_URL` — URL base de la app, por defecto `http://localhost:3000`.
- `NEXTAUTH_SECRET` — secreto para sesiones de NextAuth.
- `ADMIN_USERNAME` — usuario administrador inicial.
- `ADMIN_PASSWORD` — contraseña en texto plano; el seed la hashea con bcrypt.
- `DEFAULT_BRANCH_NAME` — nombre de la sucursal por defecto (usado por el seed).
- `NEW_BRANCH_NAME` (opcional) — nombre de una segunda sucursal a crear vía seed.
- `NEW_BRANCH_USERNAME` (opcional) — usuario de la segunda sucursal a crear vía seed.
- `NEW_BRANCH_PASSWORD` (opcional) — contraseña en texto plano del usuario de la segunda sucursal; el seed la hashea con bcrypt.
- `NEXT_PUBLIC_CAJA_REFRESH_INTERVAL_MS` — intervalo de refresco del panel de caja en milisegundos (por defecto 5000 ms).

> **Importante:** para que el comportamiento sea idéntico en desarrollo y producción, `DATABASE_URL` debe apuntar a la misma base de datos (o a una réplica/branch de Neon) en ambos entornos. No dejar `DATABASE_URL` apuntando a `localhost` si no hay un PostgreSQL local corriendo; en ese caso usá el mismo URL de Neon que en Vercel.

## Configuración del blueprint de Devin
- El blueprint para el snapshot de Devin vive en `.devin/environment.yaml`.
- Para subirlo a Devin Cloud se requiere autenticación con `devin.exe auth login` y un repositorio en GitHub.
- El flujo de DRS es:
  1. `devin.exe cloud drs blueprint-create --repo <owner/repo> --from-file .devin/environment.yaml`
  2. `devin.exe cloud drs build`

## Estructura del proyecto

- `src/app/` — páginas y rutas API
- `src/application/` — servicios de aplicación (casos de uso y coordinación)
- `src/repositories/` — capa de repositorios
- `src/db/` — esquema, conexión y seeds de Drizzle
- `src/components/` — componentes React
- `src/config/` — constantes de configuración (APIs, caja, paginación)
- `src/domain/` — tipos y errores de dominio
- `src/hooks/` — hooks personalizados de React
- `src/lib/` — utilidades (`cn`, `json`, `money`, `date`, etc.)

## Tecnologías
- Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Drizzle ORM, PostgreSQL, NextAuth v5.

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

## Testing

### Setup de tests

`jest.setup.ts` registra automáticamente `afterEach(cleanup)` de `@testing-library/react` para desmontar componentes y hooks entre tests. Esto evita actualizaciones de estado tardías y warnings de `act(...)`.

```ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
```

### Hooks con carga asíncrona

Todo hook que dispare `fetch` en `useEffect` debe:

1. Declarar una bandera `cancelled` o usar un `useRef` para saber si aún está montado.
2. No llamar `setState` si el componente ya se desmontó.
3. Retornar una función de cleanup que active la bandera.

Ejemplo con `useRef` (reutilizable en hooks expuestos fuera de un `useEffect`):

```ts
const isMountedRef = useRef(true);

useEffect(() => {
  isMountedRef.current = true;
  queueMicrotask(() => void load());
  return () => {
    isMountedRef.current = false;
  };
}, []);

async function load() {
  try {
    const data = await fetchData();
    if (!isMountedRef.current) return;
    setData(data);
  } catch (error) {
    if (!isMountedRef.current) return;
    setError(...);
  } finally {
    if (isMountedRef.current) setLoading(false);
  }
}
```

Ejemplo con bandera local dentro del `useEffect`:

```ts
useEffect(() => {
  let cancelled = false;

  async function load() {
    const data = await fetchData();
    if (cancelled) return;
    setData(data);
  }

  load();

  return () => {
    cancelled = true;
  };
}, []);
```

### Tests de hooks

- Si un hook inicia una carga asíncrona, el test debe esperar a que se estabilice con `waitFor`:
  ```ts
  const { result } = renderHook(() => useMyHook());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  ```
- No dejar tests sincrónicos que terminen antes de que el `useEffect` asíncrono complete.
- Para eventos asíncronos, preferir `await act(async () => { ... })` o `userEvent` sobre `fireEvent` cuando sea posible.

## Troubleshooting

### `ECONNREFUSED` al conectar con PostgreSQL en desarrollo

- Verificar que `DATABASE_URL` en `.env.local` no apunte a `localhost` si no hay un PostgreSQL local corriendo.
- Preferir usar la misma URL de Neon que en Vercel (`POSTGRES_URL`) para que dev y prod se comporten igual.
- Revisar `src/db/index.ts` para entender el orden de resolución: `DATABASE_URL` → `POSTGRES_URL` → `POSTGRES_PRISMA_URL`.
- Para migraciones, `drizzle.config.ts` usa `DATABASE_URL_UNPOOLED` → `POSTGRES_URL_NON_POOLING` → `DATABASE_URL` → `POSTGRES_URL`.

## Auditorías e informes

El directorio `.devin/informes` contiene la guía de lecciones aprendidas de las auditorías realizadas en el proyecto.

- Lecciones aprendidas: `.devin/informes/lecciones-aprendidas.md`
- Guía para escribir prompts: `.devin/prompts/README.md`

Antes de iniciar tareas de auditoría, refactorización, integridad de datos, configuración de entorno o escritura de prompts, consultar estos archivos para evitar regresiones documentadas.

## Consideraciones técnicas futuras

- `authService.ts` abstrae el almacenamiento de intentos fallidos mediante `RateLimitStore` (`src/lib/rate-limit-store.ts`). La implementación por defecto es `InMemoryRateLimitStore`. Para producción con múltiples instancias, usar `DbRateLimitStore` configurando `RATE_LIMIT_STORE_PROVIDER=db` (requiere la tabla `login_attempts`, generada con `npx drizzle-kit generate` y aplicada con `npx drizzle-kit push`).
- Los resúmenes de caja y cierre (`productsSummary`, `criticalSuppliesSummary`) se almacenan como `text` con JSON string. Considerar migrar las columnas a `jsonb` para aprovechar la validación nativa de PostgreSQL.
