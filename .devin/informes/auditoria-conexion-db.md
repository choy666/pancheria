# Informe de auditoría — Error de conexión a la base de datos en desarrollo

## Resumen ejecutivo

| Campo | Valor |
| ----- | ----- |
| Fecha | 2026-08-09 |
| Proyecto | `pancheria` |
| Entorno afectado | Desarrollo local (Windows, `npm run dev`) |
| Entorno estable | Producción en Vercel |
| Tipo de error | `ECONNREFUSED` al conectar con PostgreSQL |
| Estado | Corregido y verificado |

## Problema reportado

En producción (Vercel) la aplicación funcionaba correctamente. En desarrollo local (`npm run dev`) fallaba al intentar consultar la base de datos con errores del tipo:

```
Failed query: select "id", "name", ... from "products" ...
[cause]: AggregateError [ECONNREFUSED]
```

Los errores afectaban páginas del panel, endpoints de API (`/api/caja/resumen`, `/api/productos`, `/api/stock`, `/api/cierre`) y generaban códigos `503` o `500` dependiendo de si la ruta capturaba explícitamente el error de conexión.

## Hipótesis iniciales

1. **Diferencia de variables de entorno**: en Vercel `DATABASE_URL` apunta a Neon; en local apunta a otro host.
2. **Driver incorrecto**: la URL de Neon podría estar usando el driver `pg` en lugar del driver serverless de Neon.
3. **PostgreSQL local inactivo**: `localhost:5432` no responde en la máquina de desarrollo.
4. **SSL o parámetros de conexión mal configurados**: la URL local no incluye `sslmode` ni usa el pooler de Neon.
5. **Pool global creado fuera de un request handler**: posible impacto en entornos serverless (descartado para este caso).

## Causa raíz confirmada

El archivo `.env.local` contenía una URL de desarrollo apuntando a una instancia local de PostgreSQL que no estaba corriendo:

```text
DATABASE_URL=postgresql://postgres@localhost:5432/pancheria
```

El test de conectividad `Test-NetConnection -ComputerName localhost -Port 5432` confirmó que el puerto `5432` no estaba abierto en la máquina local.

A su vez, el mismo `.env.local` ya contenía las variables `POSTGRES_URL` y `DATABASE_URL_UNPOOLED` generadas por Vercel Postgres (Neon), pero el código solo leía `DATABASE_URL`. Esa discordancia explicaba el comportamiento asimétrico:

- **Vercel**: `DATABASE_URL` se configuró manualmente con el URL de Neon → la app funciona.
- **Local**: `DATABASE_URL` apuntaba a `localhost:5432` sin servidor → la app falla.

## Impacto

- Funcionalidades que dependen de `db` no cargan en desarrollo: productos, stock, caja, cierre.
- Los endpoints devolvían `503` o `500` sin consistencia.
- El `error.tsx` del panel capturaba el error en la UI, pero la experiencia no era la ideal.
- La diferencia entre entornos dificulta reproducir y corregir errores de negocio.

## Archivos auditados

- `src/db/index.ts` — inicialización del cliente Drizzle.
- `drizzle.config.ts` — configuración de Drizzle Kit para migraciones.
- `.env.example` — plantilla de variables de entorno.
- `.env.local` — configuración local real.
- `AGENTS.md` — documentación de comandos y variables.
- `.devin/environment.yaml` — blueprint de entorno.
- `src/lib/db-errors.ts` y `src/domain/errors.ts` — detección de errores de conexión.
- `src/app/api/*/route.ts` — rutas que exponen el error al cliente.
- `src/app/(panel)/productos/page.tsx` — página server renderizada que consulta productos.

## Correcciones aplicadas

### 1. Configuración local

Se actualizó `.env.local` para que `DATABASE_URL` apunte a la misma base de datos Neon que se usa en Vercel, garantizando el mismo comportamiento en desarrollo y producción.

### 2. Resolución robusta de `DATABASE_URL` en runtime

En `src/db/index.ts` se reemplazó la lectura directa de `process.env.DATABASE_URL` por una función que prueba varias variables de entorno compatibles con Vercel Postgres:

```text
DATABASE_URL → POSTGRES_URL → POSTGRES_PRISMA_URL
```

De este modo, si en un entorno solo existen `POSTGRES_URL`/`POSTGRES_PRISMA_URL` (como ocurre tras un `vercel env pull`), la aplicación sigue funcionando sin intervención manual.

### 3. Separación de URL pooled y unpooled

En `drizzle.config.ts` se configuró la siguiente jerarquía para migraciones:

```text
DATABASE_URL_UNPOOLED → POSTGRES_URL_NON_POOLING → DATABASE_URL → POSTGRES_URL
```

Esto evita usar el pooler (`pgbouncer`) para operaciones DDL y mantiene compatibilidad con Vercel Postgres.

### 4. Documentación

- `.env.example`: se agregó `DATABASE_URL_UNPOOLED` con una descripción clara.
- `AGENTS.md`: se documentó la diferencia entre URL de runtime y URL de migraciones, se agregó una advertencia sobre no dejar `DATABASE_URL` apuntando a `localhost` sin un PostgreSQL real y se añadió una sección de troubleshooting.
- `README.md`: se convirtió de UTF-16 a UTF-8 y se agregó una nota sobre la necesidad de que `DATABASE_URL` apunte a la misma base en desarrollo y producción, así como la URL unpooled para migraciones.
- `.devin/environment.yaml`: se actualizó la sección `database` para reflejar la nueva resolución de variables.
- `.devin/prompts/auditoria-cobertura-caja-ventas-stock.md` y `.devin/prompts/auditoria-historial-ventas-caja.md`: se actualizó el checklist de conexión a base de datos para que considere `DATABASE_URL`, `POSTGRES_URL` o `POSTGRES_PRISMA_URL`.

## Verificaciones realizadas

| Verificación | Resultado |
| ------------ | --------- |
| Conexión directa con `npx tsx` y `SELECT 1` | `Conexión OK` |
| `npx tsc --noEmit` | Éxito |
| `npm run lint` | Éxito |
| `npm run build` | Éxito |
| `npm test` | 278 tests pasados |
| `npm run dev` arranca y responde | Éxito en `http://localhost:3000` |
| Navegación por panel y endpoints (`/productos`, `/stock`, `/cierre`, `/api/caja/resumen`, `/api/cierre`, `/api/stock`) | Todos devuelven `200` |
| Login + `/api/productos?includeAvailability=true` | Devuelve productos con disponibilidad |

## Checklist de cobertura

### Configuración y entorno

- [x] `DATABASE_URL` en `.env.local` coincide con el entorno productivo.
- [x] `DATABASE_URL_UNPOOLED` está disponible para migraciones y `drizzle-kit`.
- [x] El código soporta nombres de variables de Vercel Postgres (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`).
- [x] El código soporta `DATABASE_URL_UNPOOLED` y `POSTGRES_URL_NON_POOLING` para migraciones.
- [x] La documentación (`AGENTS.md`, `.env.example`, `.devin/environment.yaml`) refleja la configuración correcta.

### Robustez del cliente de base de datos

- [x] `src/db/index.ts` mantiene el selector de driver Neon vs `pg` según el host.
- [x] El error cuando no hay URL configurada es descriptivo.
- [x] No se hardcodean credenciales en el código fuente.

### Manejo de errores

- [x] `src/lib/db-errors.ts` detecta `ECONNREFUSED` y errores de conexión de Drizzle.
- [x] Algunas rutas (`/api/caja/resumen`, `/api/productos`, `/api/caja/historial`) devuelven `503` con un mensaje claro cuando hay error de conexión.
- [ ] Otras rutas (`/api/cierre`, `/api/stock`, etc.) aún devuelven `500` ante un error de conexión. Se recomienda unificar el manejo con `isDatabaseConnectionError` o un helper centralizado.

## Recomendaciones

1. **No usar `.env.local` con `localhost` salvo que haya un PostgreSQL local corriendo**. Si el objetivo es desarrollar contra la misma base de datos de producción, usar el mismo URL de Neon en local.
2. **Para tests E2E**, usar una base de datos de prueba (branch de Neon o una instancia local exclusiva) porque `tests/e2e/global-setup.ts` trunca tablas y re-seedea.
3. **Unificar el manejo de errores de conexión** en todas las rutas de API para que siempre devuelvan `503` con un mensaje amigable.
4. **Considerar un helper `handleApiError`** en `src/lib/api-errors.ts` que centralice `UnauthorizedError`, `DomainError` y `DatabaseConnectionError` y reduzca la duplicación en cada `route.ts`.
5. **Revisar la creación del `NeonPool` a nivel de módulo** en escenarios de concurrencia alta en Vercel; si aparecen errores de conexión agotada, crear el pool dentro de cada request handler y cerrarlo al finalizar.

## Conclusión

El error `ECONNREFUSED` en desarrollo fue causado por una `DATABASE_URL` apuntando a un PostgreSQL local inexistente. Se corrigió la configuración local, se hizo la resolución de variables más robusta, se actualizó la documentación (`README.md`, `AGENTS.md`, `.env.example`, `.devin/environment.yaml` y los prompts de auditoría) y se verificó que `npm run build` y `npm run dev` funcionan sin errores de conexión. La aplicación ahora se comporta de la misma manera en desarrollo y en Vercel.
