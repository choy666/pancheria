# Panchería - Sistema de Gestión

Sistema web para la gestión de stock y ventas de una panchería.

## Tecnologías

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Drizzle ORM
- PostgreSQL (Neon)
- NextAuth v5

## Requisitos

- Node.js 20 LTS o superior
- PostgreSQL (recomendado Neon)

## Configuración

1. Copiar `.env.example` a `.env.local` y completar las variables.
2. **Importante para dev/prod idénticos**: `DATABASE_URL` debe apuntar a la misma base de datos que Vercel. Si usás Vercel Postgres, también podés usar `POSTGRES_URL`/`POSTGRES_PRISMA_URL` porque `src/db/index.ts` las resuelve automáticamente.
3. Para migraciones (`drizzle-kit`) usar una URL sin pooler: `DATABASE_URL_UNPOOLED` o `POSTGRES_URL_NON_POOLING`.
4. Instalar dependencias: `npm install`
5. Generar y empujar migraciones: `npx drizzle-kit push`
6. Ejecutar seed: `npx tsx src/db/seeds.ts`
7. Iniciar en desarrollo: `npm run dev`

## Comandos

- `npm run dev` — modo desarrollo
- `npm run build` — compilar
- `npm run start` — iniciar servidor de producción
- `npm run analyze` — analizar bundle
- `npm run lint` — lint
- `npx tsc --noEmit` — verificación de tipos
- `npm test` — tests unitarios
- `npm run test:e2e` (o `npx playwright test`) — tests end-to-end
- `npx drizzle-kit generate` — generar migraciones
- `npx drizzle-kit push` — empujar migraciones
- `npx tsx src/db/seeds.ts` — ejecutar seed

## Estructura

- `src/app/` — páginas y rutas API
- `src/application/` — servicios de aplicación (casos de uso y coordinación)
- `src/repositories/` — capa de repositorios
- `src/db/` — esquema, conexión y seeds de Drizzle
- `src/components/` — componentes React
- `src/config/` — constantes de configuración (APIs, caja, paginación)
- `src/domain/` — tipos y errores de dominio
- `src/hooks/` — hooks personalizados de React
- `src/lib/` — utilidades (`cn`, `json`, `money`, `date`, etc.)

## Guía interactiva

La app incluye un recorrido interactivo con `driver.js`. El tour se inicia manualmente desde el botón **Guía** del header (también disponible en el menú móvil). Una vez iniciado, continúa automáticamente al navegar entre las secciones (Panel, Ventas, Productos, Stock, Cierre de caja e Historial de cierres) y se puede cerrar en cualquier momento con la cruz, la tecla `Escape`, el botón **Finalizar** o volviendo a presionar **Guía**.

## Multi-sucursal

El sistema soporta múltiples sucursales con aislamiento de datos:

- Cada usuario pertenece a una única sucursal (`users.branchId`).
- La sucursal se determina automáticamente al iniciar sesión a partir del usuario.
- Productos, recetas, stock, cajas, ventas, movimientos y cierres diarios se filtran por `branchId`.
- Las páginas `/sucursales` y `/usuarios` permiten a los administradores crear nuevas sucursales y usuarios.
- El seed usa `DEFAULT_BRANCH_NAME` para crear la sucursal inicial y asignarle el administrador (`ADMIN_USERNAME`).

## Notas

- El sistema crea un administrador inicial desde las variables de entorno; se pueden crear más usuarios con rol `admin` desde `/usuarios`.
- Los insumos críticos (pan, salchicha, bebida) se descuentan automáticamente.
- Los insumos manuales son informativos en recetas.
- `src/db/index.ts` elige el driver correcto (Neon serverless o `pg`) según el host de la URL.
